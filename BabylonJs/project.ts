import * as BABYLON from "babylonjs"
import * as CSOUND from "./@doc.e.dub/csound-browser"

//#region Non-playground setup

declare global {
    interface Document {
        Csound: CSOUND.Csound
        isProduction: boolean // If `falsey` then we're running in the playground.
    }
}

document.isProduction = true

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

        _cameraMatrixUpdatesPerSecond = 10
        get cameraMatrixUpdatesPerSecond() { return this._cameraMatrixUpdatesPerSecond }
        set cameraMatrixUpdatesPerSecond(value) { this._cameraMatrixUpdatesPerSecond = value }
        get cameraMatrixMillisecondsPerUpdate() { return 1000 / this.cameraMatrixUpdatesPerSecond }

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

        //#region Camera matrix

        _cameraMatrix = null
        set cameraMatrix(value) {
            if (this._cameraMatrix != null && !this.cameraMatrixIsDirty) {
                for (let i = 0; i < 16; i++) {
                    if (0.01 < Math.abs(value[i] - this._cameraMatrix[i])) {
                        this._cameraMatrixIsDirty = true
                        break
                    }
                }
            }
            if (this.cameraMatrixIsDirty) {
                this._cameraMatrix = Array.from(value)
            }
        }

        _cameraMatrixIsDirty = true
        get cameraMatrixIsDirty() { return this._cameraMatrixIsDirty }

        #startUpdatingCameraMatrix = () => {
            // setInterval(() => {
            //     if (!this.isStarted) {
            //         return
            //     }
            //     if (this.cameraMatrixIsDirty) {
            //         console.debug('Setting Csound listener position to ['
            //             + this._cameraMatrix[12] + ', '
            //             + this._cameraMatrix[13] + ', '
            //             + this._cameraMatrix[14] + ']')
            //         this.#csoundObj.tableCopyIn("1", this._cameraMatrix)
            //         this._cameraMatrixIsDirty = false
            //     }
            // }, this.cameraMatrixMillisecondsPerUpdate)
        }

        //#endregion

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
				if (!!csound && !!this.#camera) {
					csound.cameraMatrix = this.#camera.worldMatrixFromCache.m
				}
			})
		}

        //#region Options

		#slowSpeed = 0.25
		get slowSpeed() { return this.#slowSpeed }

		#fastSpeed = 1.5
		get fastSpeed() { return this.#fastSpeed }

		#height = 2
		get height() { return this.#height }

		#settingIndex = 2
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
			{ position: new BABYLON.Vector3(-80, this.height, 800), target: new BABYLON.Vector3(0, 200, 0) },
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
            if (input.heldKeys[KeyCode.CapsLock] || input.heldKeys[KeyCode.Shift] || input.heldKeys[KeyCode.Space]) {
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

    BABYLON.Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => { csound.onAudioEngineUnlocked() })
    BABYLON.Engine.audioEngine.lock()

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

    const directionalLight = new BABYLON.DirectionalLight('', new BABYLON.Vector3(0, -1, 0), scene)
    directionalLight.intensity = 1

	const pointLight = new BABYLON.PointLight('', new BABYLON.Vector3(0, 0, 0), scene)
	pointLight.intensity = 0.5
	pointLight.range = 200

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
			const mesh = scene.getMeshByName('MainTriangles')
			mesh.material = material
			mainTriangleMeshHeight = mesh.getBoundingInfo().boundingBox.maximumWorld.y
			const outerMesh = mesh.clone('OuterMainTriangles', mesh.parent)
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
		return makeMesh(
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
	}
	const trianglePolygonMesh = makeTrianglePolygonMesh()

	//#endregion

	//#region Sound object utilities

	let soundObjects = []

	const findSoundObject = (uuid) => {
		for (let i = 0; i < soundObjects.length; i++) {
			if (soundObjects[i].uuid == uuid) {
				return soundObjects[i]
			}
		}
		return null
	}

    const startAudioVisuals = () => {
        let csdData = JSON.parse(csdJson)
        // console.debug('csdData =', csdData)

		Object.keys(csdData).forEach((uuid) => {
			let soundObject = findSoundObject(uuid)
			if (soundObject != null) {
				soundObject.setJson(csdData[uuid])
			}
		})

        scene.registerBeforeRender(() => {
			if (!csound.playbackIsStarted) {
				// Reset sound objects.
				soundObjects.forEach((soundObject) => {
					soundObject.reset()
				})
				return;
			}

			const time = csound.audioContext.currentTime - csound.startTime;
			const deltaTime = engine.getDeltaTime() / 1000

			// Render sound objects.
			soundObjects.forEach((soundObject) => {
				soundObject.render(time, deltaTime)
			})
		})
	}

	//#endregion

	//#region class Drum

	class Drum {
		uuid = null
		maxDuration = 0.1
		minScaling = 10
		maxScaling = 100

		set position(value) {
			this.mesh.position.set(value[0], value[1], value[2])
			this.strikeMesh.position.set(value[0], value[1], value[2])
		}

		set rotation(value) {
			this.mesh.rotation.set(value[0], value[1], value[2])
			this.strikeMesh.rotation.set(value[0], value[1], value[2])
		}

		_color = null
		get color() { return this._color }
		set color(value) {
			this._color = value
			this.material.emissiveColor.set(value[0], value[1], value[2])
			this.strikeMaterial.emissiveColor.set(value[0], value[1], value[2])
		}

		constructor() {
			let material = new BABYLON.StandardMaterial('', scene)
			material.alpha = 0.999
			material.emissiveColor.set(0.5, 0.5, 0.5)
			this.material = material

			let mesh = makeTrianglePolygonMesh()
			mesh.material = this.material
			mesh.position.setAll(0)
			mesh.scaling.set(this.minScaling, 1, this.minScaling)
			mesh.bakeCurrentTransformIntoVertices()
			this.mesh = mesh

			let strikeMaterial = new BABYLON.StandardMaterial('', scene)
			strikeMaterial.alpha = 0.999
			strikeMaterial.emissiveColor.set(0.5, 0.5, 0.5)
			this.strikeMaterial = strikeMaterial

			let strikeMesh = makeTrianglePolygonMesh()
			strikeMesh.material = this.strikeMaterial
			strikeMesh.scaling.setAll(15)
			strikeMesh.position.set(0, 5, 0)
			// strikeMesh.rotation.x = Math.PI
			strikeMesh.bakeCurrentTransformIntoVertices()
			strikeMesh.isVisible = true
			this.strikeMesh = strikeMesh

			this.isVisible = false
		}

		material = null
		mesh = null

		strikeMaterial = null
		strikeMesh = null

		json = null
		header = null
		noteStartIndex = 0
		noteCount = 0

		currentNoteOnIndex = null
		nextNoteOnIndex = 0
		nextNoteOffIndex = 0
		
		_currentNoteDuration = 0
		get currentNoteDuration() { return this._currentNoteDuration }
		set currentNoteDuration(value) {
			this._currentNoteDuration = value
			this.fade = 0.999 * (1 - value / this.maxDuration)
			const scaling = this.minScaling + (this.maxScaling - this.minScaling) * (value / this.maxDuration)
			// console.debug(`Drum: duration = ${value}, alpha = ${this.material.alpha}, scaling = ${scaling}`)
			this.scaling = scaling
		}
		
		get isVisible() { return this.mesh.isVisible }
		set isVisible(value) {
			this.mesh.isVisible = value
		}

		set fade(value) {
			value = Math.max(0, value)
			
			this.alpha = value

			if (this.isVisible) {
				const redRange = 1 - this._color[0]
				const greenRange = 1 - this._color[1]
				const blueRange = 1 - this._color[2]
				const redDelta = redRange * value
				const greenDelta = greenRange * value
				const blueDelta = blueRange * value
				const r = this._color[0] + redDelta
				const g = this._color[1] + greenDelta
				const b = this._color[2] + blueDelta
				this.strikeMaterial.emissiveColor.set(r, g, b)
				// console.debug(`value = ${value}, red: original = ${this._color[0]}, range = ${redRange}, delta = ${redDelta}, final = ${r}`)

				this.strikeMesh.position.y = value * -5
				this.strikeMesh.scaling.y = 1 - value / 1.111
			}
		}

		set alpha(value) {
			this.material.alpha = value
		}

		set scaling(value) {
			this.mesh.scaling.set(value, 1, value)
		}

		noteOn = (i) => {
			if (!!this.currentNoteOnIndex) {
				if (this.json[this.currentNoteOnIndex].noteOn.isOn) {
					this.noteOff(this.currentNoteOnIndex)
				}
			}
			this.currentNoteOnIndex = i
			this.currentNoteDuration = 0
			const note = this.json[i].noteOn
			note.isOn = true
			this.position = note.xyz
			this.isVisible = true
		}

		noteOff = (i) => {
            const note = this.json[i].noteOn
            if (note.isOn) {
                this.isVisible = false;
                note.isOn = false
            }
		}

		setJson = (json) => {
			this.json = json
			this.header = json[0]

			for (let i = 1; i < json.length; i++) {
				let noteOn = json[i].noteOn
				noteOn.isOn = false

				// Skip preallocation notes.
				if (noteOn.time == 0.005) {
					continue
				}
				else if (this.noteStartIndex == 0) {
					this.noteStartIndex = i
					this.position = noteOn.xyz
				}

				noteOn.offTime = noteOn.time + this.maxDuration
				this.noteCount++
			}

			// console.debug(`Drum ${this.uuid} json ...`)
			// console.debug(json)
		}

		isReset = false

		reset = () => {
			if (this.isReset) {
				return
			}
			this.isReset = true
			this.nextNoteOnIndex = this.noteStartIndex
			this.nextNoteOffIndex = this.noteStartIndex
			this.currentNoteOnIndex = null
			this.currentNoteDuration = 0
		}

		render = (time, delta) => {
			this.isReset = false
			this.currentNoteDuration += delta
            while (this.nextNoteOnIndex < this.json.length
					&& this.json[this.nextNoteOnIndex].noteOn.time <= time) {
				if (time < this.json[this.nextNoteOffIndex].noteOn.offTime) {
					this.noteOn(this.nextNoteOnIndex);
				}
				this.nextNoteOnIndex++;
			}

			while (this.nextNoteOffIndex < this.json.length
					&& this.json[this.nextNoteOffIndex].noteOn.offTime <= time) {
				this.noteOff(this.nextNoteOffIndex);
				this.nextNoteOffIndex++;
			}
		}
	}

	const kick1 = new Drum
	kick1.uuid = 'e274e9138ef048c4ba9c4d42e836c85c'
	kick1.maxDuration = 0.24
	kick1.minScaling = 1
	kick1.maxScaling = 40
	kick1.color = [ 1, 0.5, 0.1 ]
	soundObjects.push(kick1)

	const kick2Left = new Drum
	kick2Left.uuid = '8aac7747b6b44366b1080319e34a8616'
	kick2Left.maxDuration = 0.24
	kick2Left.minScaling = 1
	kick2Left.maxScaling = 40
	kick2Left.color = [ 0.1, 1, 0.5 ]
	soundObjects.push(kick2Left)

	const kick2Right = new Drum
	kick2Right.uuid = '8e12ccc0dff44a4283211d553199a8cd'
	kick2Right.maxDuration = 0.24
	kick2Right.minScaling = 1
	kick2Right.maxScaling = 40
	kick2Right.color = [ 0.5, 0.1, 1 ]
	soundObjects.push(kick2Right)

	const snare = new Drum
	snare.uuid = '6aecd056fd3f4c6d9a108de531c48ddf'
	snare.maxDuration = 0.49
	snare.minScaling = 0.24
	snare.maxScaling = 60
	snare.color = [ 1, 0.1, 1 ]
	soundObjects.push(snare)

	//#endregion

	//#region class HiHat

	class HiHat {
		uuid = null
		y = null
		get normalizedLaserWidth() { return 0.25 }

		set color(value) {
			this.material.emissiveColor.set(value[0], value[1], value[2])
		}
	
		constructor() {
			let material = new BABYLON.StandardMaterial('', scene)
			material.emissiveColor.set(1, 1, 1)
			// material.specularColor.set(1, 1, 1)
			// material.alpha = 0.75
			this.mesh.material = this.material = material
			this.isVisible = false

			this.updateMeshNormals()
			let meshVertexData = new BABYLON.VertexData()
			meshVertexData.positions = this.meshPositions
			meshVertexData.indices = this.meshIndices
			meshVertexData.normals = this.meshNormals
			meshVertexData.applyToMesh(this.mesh, true)
		}

		material = null

		originalMeshPositions = [
			// Legs match the inside faces of the MainTriangle mesh's legs at y = 0.

			// [0] Leg point 1
			0, 0, 171.34,

			// [1] Leg point 2
			-148.385, 0, -85.67,

			// [2] Leg point 3
			148.385, 0, -86.67,

			// Center triangle's peak points down from origin.

			// [3] Center triangle point 1
			0, this.normalizedLaserWidth, -0.707 * this.normalizedLaserWidth,

			// [4] Center triangle point 2
			0.612 * this.normalizedLaserWidth, this.normalizedLaserWidth, 0.354 * this.normalizedLaserWidth,

			// [5] Center triangle point 3
			-0.612 * this.normalizedLaserWidth, this.normalizedLaserWidth, 0.354 * this.normalizedLaserWidth,

			// [6] Center triangle bottom point
			0, 0, 0,

			// [7] Ceiling point matches the inside face of the MainTriangle mesh's top triangle y at the origin.
			0, 202.46, 0
		]
		meshPositions = [ ...this.originalMeshPositions ]
		meshIndices = [
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
		meshNormals = []
		mesh = new BABYLON.Mesh('', scene)
		
		json = null
		header = null
		noteStartIndex = 0
		noteCount = 0

		nextNoteOnIndex = 0
		nextNoteOffIndex = 0

		set isVisible(value) {
			this.mesh.isVisible = value
		}

		updateMeshNormals = () => {
			BABYLON.VertexData.ComputeNormals(this.meshPositions, this.meshIndices, this.meshNormals)
		}

		setPosition = (x, y, z) => {
			// Update center triangle vertex positions only. Don't update leg or ceiling vertex positions.
			for (let i = 0; i < 4; i++) {
				const j = 9 + 3 * i
				this.meshPositions[j] = x + this.originalMeshPositions[j]
				this.meshPositions[j + 1] = y + this.originalMeshPositions[j + 1] + this.y
				this.meshPositions[j + 2] = z + this.originalMeshPositions[j + 2]
			}
			this.updateMeshNormals()
			this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this.meshPositions)
			this.mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, this.meshNormals)
		}

		noteOn = (i) => {
			const note = this.json[i].noteOn
			note.isOn = true
			this.setPosition(note.xyz[0], this.y, note.xyz[2])
			this.isVisible = true
		}

		noteOff = (i) => {
            const note = this.json[i].noteOn
            if (note.isOn) {
                this.isVisible = false;
                note.isOn = false
            }
		}

		setJson = (json) => {
			this.json = json
			this.header = json[0]

			for (let i = 1; i < json.length; i++) {
				let noteOn = json[i].noteOn
				noteOn.isOn = false

				// Skip preallocation notes.
				if (noteOn.time == 0.005) {
					continue
				}
				else if (this.noteStartIndex == 0) {
					this.noteStartIndex = i
				}

				noteOn.offTime = noteOn.time + 0.034
				this.noteCount++
			}

			// console.debug(`HiHat ${this.uuid} json ...`)
			// console.debug(json)
		}
		
		isReset = false

		reset = () => {
			if (this.isReset) {
				return
			}
			this.isReset = true
			this.nextNoteOnIndex = this.noteStartIndex
			this.nextNoteOffIndex = this.noteStartIndex
		}

		render = (time) => {
			this.isReset = false
            while (this.nextNoteOnIndex < this.json.length
					&& this.json[this.nextNoteOnIndex].noteOn.time <= time) {
				if (time < this.json[this.nextNoteOffIndex].noteOn.offTime) {
					this.noteOn(this.nextNoteOnIndex);
				}
				this.nextNoteOnIndex++;
			}

			while (this.nextNoteOffIndex < this.json.length
					&& this.json[this.nextNoteOffIndex].noteOn.offTime <= time) {
				this.noteOff(this.nextNoteOffIndex);
				this.nextNoteOffIndex++;
			}
		}
	}

	const hihat1 = new HiHat
	hihat1.uuid = 'e3e7d57082834a28b53e021beaeb783d'
	hihat1.y = 20
	hihat1.color = [ 1, 0.1, 0.1 ]
	soundObjects.push(hihat1)

	const hihat2 = new HiHat
	hihat2.uuid = '02c103e8fcef483292ebc49d3898ef96'
	hihat2.color = [ 0.1, 0.1, 1 ]
	hihat2.y = 60
	soundObjects.push(hihat2)

	//#endregion

	//#region class Bass

	class Bass {
		uuid = null
		baseScale = 1

		get rotation() { return this.mesh.rotation.y }
		set rotation(value) {
			this.mesh.rotation.y = value
		}

		meshToColor = null
	
		constructor() {
			const mesh = trianglePlaneMesh.clone('Bass')
			this.mesh = mesh

			let material = new BABYLON.StandardMaterial('', scene)
			material.emissiveColor.set(1, 1, 1)
			material.backFaceCulling = false
			material.alpha = 0.75
			this.mesh.material = this.material = material
		}

		material = null
		mesh = null

		json = null
		header = null
		noteStartIndex = 0
		noteCount = 0

		nextNoteOnIndex = 0
		nextNoteOffIndex = 0

		note = null
		nextNoteKArrayIndex = 0

		setColorFromPitch = (pitch) => {
			const hue = 63 * ((pitch - 32) / 18)
			BABYLON.Color3.HSVtoRGBToRef(hue, 1, 1, this.material.emissiveColor)
			BABYLON.Color3.HSVtoRGBToRef(hue, 0.95, 0.175, this.meshToColor.material.emissiveColor)
		}

		yFromPitch = (pitch) => {
			return ((pitch - 32) / 18) * (mainTriangleMeshHeight * this.baseScale)
		}

		scaleXZFromY = (y) => {
			// Main triangle mesh height.
			const maxHeight = 220.46 * this.baseScale

			// Triangle plane mesh scale at y = 0 (spreads points to inside edge of main triangle mesh legs).
			const maxScaleXZ = 197.624 * this.baseScale

			return Math.max(0, maxScaleXZ * ((maxHeight - y) / maxHeight))
		}

		setPitch = (pitch) => {
			this.setColorFromPitch(pitch)
			this.mesh.position.y = this.yFromPitch(pitch)
			// console.debug(`Bass y = ${this.mesh.position.y}`)
			const scaleXZ = this.scaleXZFromY(this.mesh.position.y)
			this.mesh.scaling.set(scaleXZ, 1, scaleXZ)
		}

		noteOn = (i) => {
			const note = this.json[i].noteOn
			this.note = note
			this.nextNoteKArrayIndex = 1

			this.setPitch(note.k[0].pitch)
			this.mesh.isVisible = true
		}

		noteOff = () => {
            const note = this.note
            if (!!note) {
                this.mesh.isVisible = false;
            }
			this.note = null
			this.meshToColor.material.emissiveColor.set(
				mainTrianglesDefaultColor[0],
				mainTrianglesDefaultColor[1],
				mainTrianglesDefaultColor[2])
		}

		setJson = (json) => {
			// console.debug('Bass json ...')
			// console.debug(json)

			this.json = json
			this.header = json[0]

			for (let i = 1; i < json.length; i++) {
				let noteOn = json[i].noteOn

				// Skip preallocation notes.
				if (noteOn.time == 0.005) {
					continue
				}
				else if (this.noteStartIndex == 0) {
					this.noteStartIndex = i
				}

				// Note off time = note on time + delta of last k-pass event, which should be {"volume":0}.
				noteOn.offTime = noteOn.time + noteOn.k[noteOn.k.length - 1].time
				this.noteCount++
			}
		}
		
		isReset = false

		reset = () => {
			if (this.isReset) {
				return
			}
			this.isReset = true
			this.nextNoteOnIndex = this.noteStartIndex;
			this.nextNoteOffIndex = this.noteStartIndex;
			this.nextNoteKArrayIndex = 0
		}

		render = (time) => {
			this.isReset = false
            while (this.nextNoteOnIndex < this.json.length
					&& this.json[this.nextNoteOnIndex].noteOn.time <= time) {
				if (time < this.json[this.nextNoteOffIndex].noteOn.offTime) {
					this.noteOn(this.nextNoteOnIndex);
				}
				this.nextNoteOnIndex++;
			}
			while (this.nextNoteOffIndex < this.json.length
					&& this.json[this.nextNoteOffIndex].noteOn.offTime <= time) {
				this.noteOff();
				this.nextNoteOffIndex++;
			}
			if (!!this.note) {
				const note = this.note
				const kTime = time - note.time
				if (note.k[this.nextNoteKArrayIndex].time <= kTime) {
					while (this.nextNoteKArrayIndex < note.k.length
							&& note.k[this.nextNoteKArrayIndex].time <= kTime) {
						this.nextNoteKArrayIndex++
					}
					const kItem = note.k[this.nextNoteKArrayIndex - 1]
					if (!!kItem.pitch) {
						this.setPitch(kItem.pitch)
					}
				}
			}
		}
	}
	const bass = new Bass
	bass.uuid = 'ab018f191c70470f98ac3becb76e6d13'
	bass.meshToColor = scene.getMeshByName('MainTriangles')
	soundObjects.push(bass)

	const bassDistant = new Bass
	bassDistant.uuid = 'b0ba6f144fac4f668ba6981c691277d6'
	bassDistant.baseScale = mainTrianglesOuterMeshScale
	bassDistant.rotation = mainTrianglesOuterMeshRotationY
	bassDistant.meshToColor = scene.getMeshByName('OuterMainTriangles')
	soundObjects.push(bassDistant)

	//#endregion

	//#region Csound output (.csd and .json)
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
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_4"))
	endif
	giTR_808_NoteIndex[0] = giTR_808_NoteIndex[0] + 1
	SJsonFile = sprintf("json/%s.%d.json", "e274e9138ef048c4ba9c4d42e836c85c", giTR_808_NoteIndex[0])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f", times())
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
	endif
	fprints(SJsonFile, "}}")
	ficlose(SJsonFile)
	#end
	endif
	end:
	endin
	#ifdef IS_GENERATING_JSON
	setPluginUuid(1, 0, "8aac7747b6b44366b1080319e34a8616")
	instr Json_5
	SJsonFile = sprintf("json/%s.0.json", "8aac7747b6b44366b1080319e34a8616")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_5"))
	endif
	giTR_808_NoteIndex[1] = giTR_808_NoteIndex[1] + 1
	SJsonFile = sprintf("json/%s.%d.json", "8aac7747b6b44366b1080319e34a8616", giTR_808_NoteIndex[1])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f", times())
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
	endif
	fprints(SJsonFile, "}}")
	ficlose(SJsonFile)
	#end
	endif
	end:
	endin
	#ifdef IS_GENERATING_JSON
	setPluginUuid(2, 0, "8e12ccc0dff44a4283211d553199a8cd")
	instr Json_6
	SJsonFile = sprintf("json/%s.0.json", "8e12ccc0dff44a4283211d553199a8cd")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_6"))
	endif
	giTR_808_NoteIndex[2] = giTR_808_NoteIndex[2] + 1
	SJsonFile = sprintf("json/%s.%d.json", "8e12ccc0dff44a4283211d553199a8cd", giTR_808_NoteIndex[2])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f", times())
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
	endif
	fprints(SJsonFile, "}}")
	ficlose(SJsonFile)
	#end
	endif
	end:
	endin
	#ifdef IS_GENERATING_JSON
	setPluginUuid(3, 0, "6aecd056fd3f4c6d9a108de531c48ddf")
	instr Json_7
	SJsonFile = sprintf("json/%s.0.json", "6aecd056fd3f4c6d9a108de531c48ddf")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_7"))
	endif
	giTR_808_NoteIndex[3] = giTR_808_NoteIndex[3] + 1
	SJsonFile = sprintf("json/%s.%d.json", "6aecd056fd3f4c6d9a108de531c48ddf", giTR_808_NoteIndex[3])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f", times())
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
	endif
	fprints(SJsonFile, "}}")
	ficlose(SJsonFile)
	#end
	endif
	end:
	endin
	#ifdef IS_GENERATING_JSON
	setPluginUuid(4, 0, "e3e7d57082834a28b53e021beaeb783d")
	instr Json_8
	SJsonFile = sprintf("json/%s.0.json", "e3e7d57082834a28b53e021beaeb783d")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_8"))
	endif
	giTR_808_NoteIndex[4] = giTR_808_NoteIndex[4] + 1
	SJsonFile = sprintf("json/%s.%d.json", "e3e7d57082834a28b53e021beaeb783d", giTR_808_NoteIndex[4])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f", times())
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
	endif
	fprints(SJsonFile, "}}")
	ficlose(SJsonFile)
	#end
	endif
	end:
	endin
	#ifdef IS_GENERATING_JSON
	setPluginUuid(5, 0, "02c103e8fcef483292ebc49d3898ef96")
	instr Json_9
	SJsonFile = sprintf("json/%s.0.json", "02c103e8fcef483292ebc49d3898ef96")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_9"))
	endif
	giTR_808_NoteIndex[5] = giTR_808_NoteIndex[5] + 1
	SJsonFile = sprintf("json/%s.%d.json", "02c103e8fcef483292ebc49d3898ef96", giTR_808_NoteIndex[5])
	fprints(SJsonFile, "{\\"noteOn\\":{\\"time\\":%.3f", times())
	if (giCcValues_TR_808[iOrcInstanceIndex][giCc_TR_808_positionEnabled] == 1) then
	fprints(SJsonFile, ",\\"xyz\\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
	endif
	fprints(SJsonFile, "}}")
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
	instr Json_10
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_10"))
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
	gSTriangle4BassMonoSynth_Json[] init 2
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
	setPluginUuid(7, 0, "ab018f191c70470f98ac3becb76e6d13")
	instr Json_11
	SJsonFile = sprintf("json/%s.0.json", "ab018f191c70470f98ac3becb76e6d13")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	SiJson = sprintf("{\\"noteOn\\":{\\"time\\":%.3f", iStartTime)
	SiJson = strcat(SiJson, ",\\"k\\":[")
	scoreline_i(sprintf("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_11", string_escape_i(SiJson)))
	#end
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
	setPluginUuid(8, 0, "b0ba6f144fac4f668ba6981c691277d6")
	instr Json_12
	SJsonFile = sprintf("json/%s.0.json", "b0ba6f144fac4f668ba6981c691277d6")
	fprints(SJsonFile, "{")
	fprints(SJsonFile, sprintf("\\"instanceName\\":\\"%s\\"", ""))
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
	SiJson = sprintf("{\\"noteOn\\":{\\"time\\":%.3f", iStartTime)
	SiJson = strcat(SiJson, ",\\"k\\":[")
	scoreline_i(sprintf("i \\"%s\\" 0 -1 \\"%s\\"", "JsonAppend_12", string_escape_i(SiJson)))
	#end
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
	instr Json_13
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
	scoreline_i(sprintf("i \\"%s\\" 0 0", "Json_13"))
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
const csdJson = `
	{"e274e9138ef048c4ba9c4d42e836c85c":[{"instanceName":""},{"noteOn":{"time":7.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":8.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":9.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":10.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":11.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":12.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":13.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":14.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":15.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":16.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":17.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":18.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":19.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":20.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":21.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":22.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":23.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":24.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":25.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":26.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":27.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":28.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":29.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":30.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":31.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":32.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":33.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":34.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":35.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":36.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":37.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":38.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":39.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":40.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":41.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":42.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":43.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":44.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":45.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":46.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":63.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":64.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":65.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":66.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":67.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":68.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":69.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":70.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":71.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":72.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":73.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":74.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":75.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":76.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":77.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":78.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":79.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":80.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":81.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":82.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":83.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":84.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":85.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":86.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":87.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":88.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":89.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":90.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":91.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":92.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":93.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":94.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":95.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":96.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":97.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":98.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":99.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":100.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":101.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":102.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":103.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":104.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":105.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":106.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":107.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":108.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":109.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":110.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":124.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":126.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":127.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":127.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":128.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":128.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":129.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":129.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":130.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":130.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":131.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":131.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":132.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":132.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":133.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":133.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":134.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":134.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":135.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":135.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":136.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":136.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":137.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":137.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":138.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":138.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":139.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":139.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":140.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":140.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":141.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":141.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":142.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":142.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":143.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":143.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":144.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":144.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":145.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":145.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":146.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":146.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":147.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":147.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":148.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":148.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":149.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":149.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":150.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":150.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":151.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":151.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":152.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":152.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":153.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":153.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":154.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":154.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":155.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":155.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":156.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":156.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":157.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":157.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":158.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":158.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":159.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":159.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":160.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":160.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":161.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":161.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":162.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":162.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":163.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":163.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":164.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":164.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":165.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":165.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":166.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":166.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":167.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":167.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":168.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":168.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":169.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":169.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":170.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":170.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":171.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":171.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":172.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":172.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":173.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":173.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":174.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":174.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":175.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":175.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":176.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":176.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":177.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":177.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":178.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":178.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":179.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":179.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":180.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":180.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":181.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":181.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":182.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":182.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":183.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":183.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":184.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":184.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":185.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":185.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":186.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":186.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":187.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":187.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":188.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":188.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":189.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":189.500,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":190.000,"xyz":[0.000,0.000,0.000]}},{"noteOn":{"time":190.500,"xyz":[0.000,0.000,0.000]}}],"8aac7747b6b44366b1080319e34a8616":[{"instanceName":""},{"noteOn":{"time":47.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":48.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":49.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":51.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":52.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":53.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":55.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":56.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":57.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":59.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":60.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":61.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":63.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":64.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":65.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":67.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":68.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":69.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":71.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":72.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":73.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":75.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":76.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":77.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":79.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":80.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":81.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":83.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":84.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":85.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":87.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":88.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":89.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":91.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":92.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":93.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":95.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":96.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":97.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":99.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":100.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":101.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":103.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":104.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":105.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":107.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":108.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":109.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":111.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":112.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":113.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":115.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":116.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":117.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":118.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":119.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":120.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":121.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":122.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":123.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":124.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":125.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":126.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":127.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":128.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":129.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":130.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":131.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":132.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":133.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":134.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":135.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":136.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":137.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":138.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":139.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":140.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":141.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":142.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":143.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":144.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":145.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":146.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":147.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":148.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":149.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":150.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":151.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":152.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":153.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":154.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":155.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":156.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":157.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":158.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":159.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":160.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":161.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":162.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":163.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":164.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":165.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":166.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":167.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":168.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":169.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":170.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":171.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":172.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":173.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":174.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":175.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":176.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":177.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":178.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":179.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":180.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":181.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":182.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":183.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":184.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":185.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":186.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":187.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":188.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":189.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":190.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":191.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":192.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":193.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":195.000,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":196.750,"xyz":[-20.000,0.000,20.000]}},{"noteOn":{"time":197.000,"xyz":[-20.000,0.000,20.000]}}],"8e12ccc0dff44a4283211d553199a8cd":[{"instanceName":""},{"noteOn":{"time":47.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":48.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":49.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":51.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":52.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":53.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":55.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":56.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":57.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":59.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":60.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":61.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":63.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":64.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":65.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":67.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":68.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":69.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":71.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":72.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":73.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":75.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":76.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":77.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":79.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":80.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":81.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":83.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":84.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":85.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":87.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":88.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":89.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":91.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":92.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":93.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":95.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":96.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":97.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":99.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":100.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":101.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":103.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":104.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":105.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":107.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":108.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":109.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":111.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":112.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":113.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":115.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":116.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":117.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":118.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":119.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":120.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":121.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":122.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":123.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":124.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":125.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":126.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":127.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":128.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":129.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":130.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":131.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":132.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":133.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":134.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":135.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":136.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":137.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":138.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":139.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":140.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":141.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":142.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":143.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":144.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":145.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":146.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":147.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":148.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":149.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":150.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":151.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":152.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":153.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":154.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":155.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":156.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":157.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":158.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":159.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":160.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":161.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":162.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":163.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":164.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":165.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":166.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":167.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":168.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":169.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":170.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":171.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":172.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":173.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":174.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":175.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":176.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":177.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":178.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":179.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":180.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":181.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":182.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":183.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":184.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":185.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":186.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":187.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":188.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":189.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":190.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":191.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":192.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":193.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":195.000,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":196.750,"xyz":[20.000,0.000,20.000]}},{"noteOn":{"time":197.000,"xyz":[20.000,0.000,20.000]}}],"6aecd056fd3f4c6d9a108de531c48ddf":[{"instanceName":""},{"noteOn":{"time":7.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":8.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":9.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":10.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":11.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":12.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":13.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":14.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":15.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":16.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":17.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":18.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":19.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":20.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":21.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":22.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":23.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":24.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":25.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":26.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":27.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":28.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":29.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":30.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":31.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":32.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":33.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":34.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":35.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":36.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":37.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":38.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":39.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":40.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":41.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":42.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":43.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":44.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":45.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":46.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":63.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":64.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":65.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":66.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":67.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":68.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":69.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":70.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":71.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":72.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":73.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":74.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":75.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":76.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":77.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":78.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":79.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":80.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":81.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":82.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":83.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":84.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":85.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":86.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":87.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":88.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":89.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":90.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":91.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":92.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":93.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":94.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":95.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":96.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":97.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":98.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":99.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":100.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":101.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":102.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":103.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":104.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":105.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":106.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":107.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":108.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":109.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":110.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":126.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":127.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":128.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":129.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":130.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":131.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":132.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":133.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":134.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":135.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":136.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":137.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":138.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":139.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":140.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":141.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":142.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":143.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":144.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":145.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":146.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":147.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":148.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":149.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":150.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":151.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":152.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":153.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":154.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":155.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":156.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":157.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":158.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":159.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":160.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":161.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":162.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":163.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":164.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":165.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":166.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":167.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":168.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":169.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":170.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":171.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":172.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":173.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":174.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":175.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":176.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":177.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":178.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":179.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":180.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":181.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":182.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":183.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":184.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":185.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":186.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":187.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":188.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":189.500,"xyz":[0.000,0.000,50.000]}},{"noteOn":{"time":190.500,"xyz":[0.000,0.000,50.000]}}],"e3e7d57082834a28b53e021beaeb783d":[{"instanceName":""},{"noteOn":{"time":7.000,"xyz":[76.575,0.000,-41.732]}},{"noteOn":{"time":7.125,"xyz":[22.912,0.000,73.484]}},{"noteOn":{"time":7.250,"xyz":[42.486,0.000,-97.556]}},{"noteOn":{"time":7.375,"xyz":[-94.356,0.000,12.151]}},{"noteOn":{"time":7.500,"xyz":[-12.961,0.000,36.429]}},{"noteOn":{"time":7.625,"xyz":[93.219,0.000,-58.801]}},{"noteOn":{"time":7.750,"xyz":[-75.084,0.000,-36.212]}},{"noteOn":{"time":7.875,"xyz":[-73.948,0.000,45.195]}},{"noteOn":{"time":8.000,"xyz":[-3.301,0.000,-1.343]}},{"noteOn":{"time":8.125,"xyz":[14.572,0.000,55.692]}},{"noteOn":{"time":8.250,"xyz":[31.757,0.000,64.604]}},{"noteOn":{"time":8.375,"xyz":[2.589,0.000,48.635]}},{"noteOn":{"time":8.500,"xyz":[67.563,0.000,-75.839]}},{"noteOn":{"time":8.625,"xyz":[-20.708,0.000,95.858]}},{"noteOn":{"time":8.750,"xyz":[-77.660,0.000,48.389]}},{"noteOn":{"time":8.875,"xyz":[-38.239,0.000,-94.939]}},{"noteOn":{"time":9.000,"xyz":[-32.100,0.000,85.864]}},{"noteOn":{"time":9.125,"xyz":[-80.150,0.000,32.644]}},{"noteOn":{"time":9.250,"xyz":[99.558,0.000,-59.558]}},{"noteOn":{"time":9.375,"xyz":[65.341,0.000,-96.239]}},{"noteOn":{"time":9.500,"xyz":[-50.021,0.000,-82.800]}},{"noteOn":{"time":9.625,"xyz":[-22.777,0.000,-76.025]}},{"noteOn":{"time":9.750,"xyz":[43.860,0.000,45.905]}},{"noteOn":{"time":9.875,"xyz":[-15.021,0.000,16.898]}},{"noteOn":{"time":10.000,"xyz":[40.297,0.000,-58.592]}},{"noteOn":{"time":10.125,"xyz":[81.759,0.000,-27.829]}},{"noteOn":{"time":10.250,"xyz":[59.728,0.000,10.316]}},{"noteOn":{"time":10.375,"xyz":[89.309,0.000,38.181]}},{"noteOn":{"time":10.500,"xyz":[-57.682,0.000,63.334]}},{"noteOn":{"time":10.625,"xyz":[46.531,0.000,43.872]}},{"noteOn":{"time":10.750,"xyz":[-65.335,0.000,42.649]}},{"noteOn":{"time":10.875,"xyz":[43.557,0.000,-15.964]}},{"noteOn":{"time":11.000,"xyz":[-48.296,0.000,23.722]}},{"noteOn":{"time":11.125,"xyz":[-26.802,0.000,52.456]}},{"noteOn":{"time":11.250,"xyz":[10.677,0.000,-99.131]}},{"noteOn":{"time":11.375,"xyz":[-78.344,0.000,-42.723]}},{"noteOn":{"time":11.500,"xyz":[84.053,0.000,16.015]}},{"noteOn":{"time":11.625,"xyz":[-29.634,0.000,2.968]}},{"noteOn":{"time":11.750,"xyz":[68.261,0.000,39.973]}},{"noteOn":{"time":11.875,"xyz":[30.850,0.000,73.280]}},{"noteOn":{"time":12.000,"xyz":[15.130,0.000,65.651]}},{"noteOn":{"time":12.125,"xyz":[-15.554,0.000,99.534]}},{"noteOn":{"time":12.250,"xyz":[22.886,0.000,-77.463]}},{"noteOn":{"time":12.375,"xyz":[48.806,0.000,48.654]}},{"noteOn":{"time":12.500,"xyz":[33.604,0.000,-28.142]}},{"noteOn":{"time":12.625,"xyz":[-56.987,0.000,-84.713]}},{"noteOn":{"time":12.750,"xyz":[33.978,0.000,91.767]}},{"noteOn":{"time":12.875,"xyz":[73.222,0.000,52.413]}},{"noteOn":{"time":13.000,"xyz":[6.281,0.000,11.955]}},{"noteOn":{"time":13.125,"xyz":[10.667,0.000,24.790]}},{"noteOn":{"time":13.250,"xyz":[26.405,0.000,7.042]}},{"noteOn":{"time":13.375,"xyz":[-16.062,0.000,19.646]}},{"noteOn":{"time":13.500,"xyz":[-44.163,0.000,8.143]}},{"noteOn":{"time":13.625,"xyz":[-42.611,0.000,98.954]}},{"noteOn":{"time":13.750,"xyz":[24.462,0.000,41.962]}},{"noteOn":{"time":13.875,"xyz":[-82.455,0.000,27.694]}},{"noteOn":{"time":14.000,"xyz":[51.057,0.000,-43.192]}},{"noteOn":{"time":14.125,"xyz":[39.405,0.000,62.463]}},{"noteOn":{"time":14.250,"xyz":[98.355,0.000,44.896]}},{"noteOn":{"time":14.375,"xyz":[54.493,0.000,-65.186]}},{"noteOn":{"time":14.500,"xyz":[9.562,0.000,20.314]}},{"noteOn":{"time":14.625,"xyz":[-7.457,0.000,-86.306]}},{"noteOn":{"time":14.750,"xyz":[-76.817,0.000,62.027]}},{"noteOn":{"time":14.875,"xyz":[-81.300,0.000,81.359]}},{"noteOn":{"time":15.000,"xyz":[-86.948,0.000,81.300]}},{"noteOn":{"time":15.125,"xyz":[7.141,0.000,34.649]}},{"noteOn":{"time":15.250,"xyz":[22.900,0.000,1.229]}},{"noteOn":{"time":15.375,"xyz":[53.443,0.000,-24.713]}},{"noteOn":{"time":15.500,"xyz":[59.478,0.000,48.229]}},{"noteOn":{"time":15.625,"xyz":[-1.665,0.000,-36.758]}},{"noteOn":{"time":15.750,"xyz":[-11.530,0.000,43.269]}},{"noteOn":{"time":15.875,"xyz":[-90.880,0.000,54.164]}},{"noteOn":{"time":16.000,"xyz":[-9.069,0.000,-89.479]}},{"noteOn":{"time":16.125,"xyz":[51.265,0.000,38.130]}},{"noteOn":{"time":16.250,"xyz":[-38.355,0.000,5.620]}},{"noteOn":{"time":16.375,"xyz":[67.048,0.000,41.191]}},{"noteOn":{"time":16.500,"xyz":[69.907,0.000,70.831]}},{"noteOn":{"time":16.625,"xyz":[-91.695,0.000,64.619]}},{"noteOn":{"time":16.750,"xyz":[60.338,0.000,-29.908]}},{"noteOn":{"time":16.875,"xyz":[57.666,0.000,58.723]}},{"noteOn":{"time":17.000,"xyz":[53.119,0.000,-74.179]}},{"noteOn":{"time":17.125,"xyz":[22.628,0.000,-21.892]}},{"noteOn":{"time":17.250,"xyz":[53.010,0.000,29.349]}},{"noteOn":{"time":17.375,"xyz":[-63.134,0.000,-84.742]}},{"noteOn":{"time":17.500,"xyz":[26.538,0.000,46.871]}},{"noteOn":{"time":17.625,"xyz":[-46.864,0.000,59.316]}},{"noteOn":{"time":17.750,"xyz":[56.718,0.000,-7.234]}},{"noteOn":{"time":17.875,"xyz":[-37.838,0.000,76.925]}},{"noteOn":{"time":18.000,"xyz":[-65.306,0.000,-7.811]}},{"noteOn":{"time":18.125,"xyz":[21.874,0.000,-37.975]}},{"noteOn":{"time":18.250,"xyz":[-2.337,0.000,4.787]}},{"noteOn":{"time":18.375,"xyz":[-68.635,0.000,51.465]}},{"noteOn":{"time":18.500,"xyz":[72.470,0.000,31.423]}},{"noteOn":{"time":18.625,"xyz":[33.959,0.000,-46.690]}},{"noteOn":{"time":18.750,"xyz":[34.235,0.000,75.788]}},{"noteOn":{"time":18.875,"xyz":[-16.249,0.000,-15.281]}},{"noteOn":{"time":19.000,"xyz":[-60.600,0.000,-17.234]}},{"noteOn":{"time":19.125,"xyz":[59.998,0.000,-33.728]}},{"noteOn":{"time":19.250,"xyz":[-57.439,0.000,-74.565]}},{"noteOn":{"time":19.375,"xyz":[63.738,0.000,69.609]}},{"noteOn":{"time":19.500,"xyz":[56.466,0.000,-37.430]}},{"noteOn":{"time":19.625,"xyz":[81.009,0.000,65.275]}},{"noteOn":{"time":19.750,"xyz":[64.553,0.000,-61.459]}},{"noteOn":{"time":19.875,"xyz":[47.051,0.000,-32.375]}},{"noteOn":{"time":20.000,"xyz":[-54.604,0.000,47.452]}},{"noteOn":{"time":20.125,"xyz":[95.847,0.000,-76.319]}},{"noteOn":{"time":20.250,"xyz":[18.451,0.000,33.429]}},{"noteOn":{"time":20.375,"xyz":[-70.597,0.000,42.807]}},{"noteOn":{"time":20.500,"xyz":[70.457,0.000,48.904]}},{"noteOn":{"time":20.625,"xyz":[91.121,0.000,-85.920]}},{"noteOn":{"time":20.750,"xyz":[-28.124,0.000,42.789]}},{"noteOn":{"time":20.875,"xyz":[77.657,0.000,8.232]}},{"noteOn":{"time":21.000,"xyz":[-57.245,0.000,0.404]}},{"noteOn":{"time":21.125,"xyz":[73.620,0.000,11.031]}},{"noteOn":{"time":21.250,"xyz":[77.369,0.000,7.038]}},{"noteOn":{"time":21.375,"xyz":[-56.494,0.000,-15.004]}},{"noteOn":{"time":21.500,"xyz":[-12.968,0.000,-42.978]}},{"noteOn":{"time":21.625,"xyz":[-34.768,0.000,-93.710]}},{"noteOn":{"time":21.750,"xyz":[70.446,0.000,-19.820]}},{"noteOn":{"time":21.875,"xyz":[39.640,0.000,-26.300]}},{"noteOn":{"time":22.000,"xyz":[-29.037,0.000,-92.464]}},{"noteOn":{"time":22.125,"xyz":[-39.633,0.000,-63.452]}},{"noteOn":{"time":22.250,"xyz":[30.139,0.000,-51.837]}},{"noteOn":{"time":22.375,"xyz":[-21.579,0.000,-61.567]}},{"noteOn":{"time":22.500,"xyz":[-3.050,0.000,-0.968]}},{"noteOn":{"time":22.625,"xyz":[-54.121,0.000,23.664]}},{"noteOn":{"time":22.750,"xyz":[-97.955,0.000,59.743]}},{"noteOn":{"time":22.875,"xyz":[-26.950,0.000,-96.741]}},{"noteOn":{"time":23.000,"xyz":[56.421,0.000,74.021]}},{"noteOn":{"time":23.125,"xyz":[-16.511,0.000,27.400]}},{"noteOn":{"time":23.250,"xyz":[-16.125,0.000,-30.162]}},{"noteOn":{"time":23.375,"xyz":[1.245,0.000,61.198]}},{"noteOn":{"time":23.500,"xyz":[-53.371,0.000,-79.954]}},{"noteOn":{"time":23.625,"xyz":[54.704,0.000,-89.344]}},{"noteOn":{"time":23.750,"xyz":[-26.505,0.000,95.392]}},{"noteOn":{"time":23.875,"xyz":[31.410,0.000,95.711]}},{"noteOn":{"time":24.000,"xyz":[-50.056,0.000,31.790]}},{"noteOn":{"time":24.125,"xyz":[68.240,0.000,-82.796]}},{"noteOn":{"time":24.250,"xyz":[-20.521,0.000,-16.270]}},{"noteOn":{"time":24.375,"xyz":[-88.695,0.000,-85.313]}},{"noteOn":{"time":24.500,"xyz":[75.655,0.000,85.687]}},{"noteOn":{"time":24.625,"xyz":[-70.053,0.000,-38.082]}},{"noteOn":{"time":24.750,"xyz":[94.153,0.000,-6.578]}},{"noteOn":{"time":24.875,"xyz":[-80.778,0.000,-3.074]}},{"noteOn":{"time":25.000,"xyz":[64.261,0.000,-72.968]}},{"noteOn":{"time":25.125,"xyz":[75.225,0.000,33.518]}},{"noteOn":{"time":25.250,"xyz":[-70.857,0.000,87.639]}},{"noteOn":{"time":25.375,"xyz":[-22.347,0.000,-48.880]}},{"noteOn":{"time":25.500,"xyz":[-45.725,0.000,69.586]}},{"noteOn":{"time":25.625,"xyz":[63.952,0.000,9.795]}},{"noteOn":{"time":25.750,"xyz":[-86.580,0.000,-59.988]}},{"noteOn":{"time":25.875,"xyz":[-70.536,0.000,87.345]}},{"noteOn":{"time":26.000,"xyz":[11.515,0.000,-92.309]}},{"noteOn":{"time":26.125,"xyz":[37.901,0.000,85.350]}},{"noteOn":{"time":26.250,"xyz":[-46.152,0.000,-47.004]}},{"noteOn":{"time":26.375,"xyz":[76.566,0.000,1.036]}},{"noteOn":{"time":26.500,"xyz":[20.903,0.000,40.878]}},{"noteOn":{"time":26.625,"xyz":[40.664,0.000,11.828]}},{"noteOn":{"time":26.750,"xyz":[58.233,0.000,-11.276]}},{"noteOn":{"time":26.875,"xyz":[-18.910,0.000,-30.520]}},{"noteOn":{"time":27.000,"xyz":[-59.238,0.000,-89.027]}},{"noteOn":{"time":27.125,"xyz":[0.075,0.000,-49.349]}},{"noteOn":{"time":27.250,"xyz":[-79.135,0.000,12.368]}},{"noteOn":{"time":27.375,"xyz":[-70.948,0.000,-39.206]}},{"noteOn":{"time":27.500,"xyz":[-80.386,0.000,-48.289]}},{"noteOn":{"time":27.625,"xyz":[-26.872,0.000,-61.747]}},{"noteOn":{"time":27.750,"xyz":[70.569,0.000,48.001]}},{"noteOn":{"time":27.875,"xyz":[56.531,0.000,55.413]}},{"noteOn":{"time":28.000,"xyz":[75.474,0.000,50.840]}},{"noteOn":{"time":28.125,"xyz":[53.406,0.000,-36.185]}},{"noteOn":{"time":28.250,"xyz":[-18.749,0.000,46.953]}},{"noteOn":{"time":28.375,"xyz":[-61.659,0.000,80.074]}},{"noteOn":{"time":28.500,"xyz":[37.650,0.000,-75.264]}},{"noteOn":{"time":28.625,"xyz":[-59.006,0.000,59.501]}},{"noteOn":{"time":28.750,"xyz":[-55.056,0.000,68.671]}},{"noteOn":{"time":28.875,"xyz":[39.196,0.000,54.297]}},{"noteOn":{"time":29.000,"xyz":[51.036,0.000,5.510]}},{"noteOn":{"time":29.125,"xyz":[-25.094,0.000,3.187]}},{"noteOn":{"time":29.250,"xyz":[-92.645,0.000,-25.919]}},{"noteOn":{"time":29.375,"xyz":[27.391,0.000,49.375]}},{"noteOn":{"time":29.500,"xyz":[42.914,0.000,40.615]}},{"noteOn":{"time":29.625,"xyz":[28.009,0.000,33.699]}},{"noteOn":{"time":29.750,"xyz":[65.913,0.000,31.444]}},{"noteOn":{"time":29.875,"xyz":[-49.032,0.000,59.853]}},{"noteOn":{"time":30.000,"xyz":[52.247,0.000,4.961]}},{"noteOn":{"time":30.125,"xyz":[64.438,0.000,-21.449]}},{"noteOn":{"time":30.250,"xyz":[30.314,0.000,34.716]}},{"noteOn":{"time":30.375,"xyz":[76.388,0.000,87.517]}},{"noteOn":{"time":30.500,"xyz":[21.477,0.000,-74.483]}},{"noteOn":{"time":30.625,"xyz":[-40.475,0.000,-5.830]}},{"noteOn":{"time":30.750,"xyz":[-54.430,0.000,-65.589]}},{"noteOn":{"time":30.875,"xyz":[-10.293,0.000,37.875]}},{"noteOn":{"time":31.000,"xyz":[-49.179,0.000,18.428]}},{"noteOn":{"time":31.125,"xyz":[-17.784,0.000,-81.359]}},{"noteOn":{"time":31.250,"xyz":[-22.445,0.000,-19.045]}},{"noteOn":{"time":31.375,"xyz":[-39.756,0.000,29.142]}},{"noteOn":{"time":31.500,"xyz":[15.070,0.000,-61.381]}},{"noteOn":{"time":31.625,"xyz":[-60.006,0.000,36.931]}},{"noteOn":{"time":31.750,"xyz":[-38.951,0.000,-19.451]}},{"noteOn":{"time":31.875,"xyz":[-33.248,0.000,-86.275]}},{"noteOn":{"time":32.000,"xyz":[42.884,0.000,-58.095]}},{"noteOn":{"time":32.125,"xyz":[-13.695,0.000,58.634]}},{"noteOn":{"time":32.250,"xyz":[10.291,0.000,63.528]}},{"noteOn":{"time":32.375,"xyz":[-13.905,0.000,12.209]}},{"noteOn":{"time":32.500,"xyz":[-41.410,0.000,-40.396]}},{"noteOn":{"time":32.625,"xyz":[90.472,0.000,-91.805]}},{"noteOn":{"time":32.750,"xyz":[92.021,0.000,-34.784]}},{"noteOn":{"time":32.875,"xyz":[-55.584,0.000,59.838]}},{"noteOn":{"time":33.000,"xyz":[-13.522,0.000,-14.357]}},{"noteOn":{"time":33.125,"xyz":[-29.877,0.000,-72.347]}},{"noteOn":{"time":33.250,"xyz":[-38.971,0.000,19.295]}},{"noteOn":{"time":33.375,"xyz":[-69.192,0.000,-34.499]}},{"noteOn":{"time":33.500,"xyz":[17.599,0.000,-23.834]}},{"noteOn":{"time":33.625,"xyz":[86.112,0.000,91.869]}},{"noteOn":{"time":33.750,"xyz":[58.199,0.000,63.653]}},{"noteOn":{"time":33.875,"xyz":[73.489,0.000,-16.783]}},{"noteOn":{"time":34.000,"xyz":[-60.941,0.000,61.649]}},{"noteOn":{"time":34.125,"xyz":[99.939,0.000,36.266]}},{"noteOn":{"time":34.250,"xyz":[-28.940,0.000,58.753]}},{"noteOn":{"time":34.375,"xyz":[78.472,0.000,96.118]}},{"noteOn":{"time":34.500,"xyz":[-74.179,0.000,71.504]}},{"noteOn":{"time":34.625,"xyz":[-6.327,0.000,97.058]}},{"noteOn":{"time":34.750,"xyz":[56.831,0.000,18.484]}},{"noteOn":{"time":34.875,"xyz":[30.738,0.000,12.936]}},{"noteOn":{"time":35.000,"xyz":[94.996,0.000,-28.810]}},{"noteOn":{"time":35.125,"xyz":[52.373,0.000,-36.012]}},{"noteOn":{"time":35.250,"xyz":[27.968,0.000,53.529]}},{"noteOn":{"time":35.375,"xyz":[57.907,0.000,-23.018]}},{"noteOn":{"time":35.500,"xyz":[-77.355,0.000,11.826]}},{"noteOn":{"time":35.625,"xyz":[-90.987,0.000,-54.440]}},{"noteOn":{"time":35.750,"xyz":[-99.791,0.000,-72.784]}},{"noteOn":{"time":35.875,"xyz":[56.408,0.000,-12.361]}},{"noteOn":{"time":36.000,"xyz":[23.072,0.000,-7.708]}},{"noteOn":{"time":36.125,"xyz":[51.898,0.000,46.776]}},{"noteOn":{"time":36.250,"xyz":[-96.877,0.000,-76.117]}},{"noteOn":{"time":36.375,"xyz":[80.155,0.000,34.336]}},{"noteOn":{"time":36.500,"xyz":[90.625,0.000,33.847]}},{"noteOn":{"time":36.625,"xyz":[-5.408,0.000,59.368]}},{"noteOn":{"time":36.750,"xyz":[-46.841,0.000,29.737]}},{"noteOn":{"time":36.875,"xyz":[-8.283,0.000,-56.959]}},{"noteOn":{"time":37.000,"xyz":[3.986,0.000,67.235]}},{"noteOn":{"time":37.125,"xyz":[-91.663,0.000,64.534]}},{"noteOn":{"time":37.250,"xyz":[89.187,0.000,26.210]}},{"noteOn":{"time":37.375,"xyz":[-24.011,0.000,35.241]}},{"noteOn":{"time":37.500,"xyz":[92.977,0.000,32.292]}},{"noteOn":{"time":37.625,"xyz":[-83.027,0.000,-51.827]}},{"noteOn":{"time":37.750,"xyz":[70.550,0.000,95.821]}},{"noteOn":{"time":37.875,"xyz":[-83.637,0.000,-0.572]}},{"noteOn":{"time":38.000,"xyz":[-32.151,0.000,-9.940]}},{"noteOn":{"time":38.125,"xyz":[54.365,0.000,-71.386]}},{"noteOn":{"time":38.250,"xyz":[-62.391,0.000,-59.465]}},{"noteOn":{"time":38.375,"xyz":[33.404,0.000,-24.919]}},{"noteOn":{"time":38.500,"xyz":[-88.917,0.000,-52.608]}},{"noteOn":{"time":38.625,"xyz":[84.319,0.000,96.858]}},{"noteOn":{"time":38.750,"xyz":[-65.211,0.000,12.623]}},{"noteOn":{"time":38.875,"xyz":[-13.981,0.000,49.154]}},{"noteOn":{"time":39.000,"xyz":[31.686,0.000,-5.936]}},{"noteOn":{"time":39.125,"xyz":[-16.992,0.000,-30.692]}},{"noteOn":{"time":39.250,"xyz":[-3.872,0.000,58.018]}},{"noteOn":{"time":39.375,"xyz":[35.127,0.000,-34.942]}},{"noteOn":{"time":39.500,"xyz":[-18.012,0.000,-47.615]}},{"noteOn":{"time":39.625,"xyz":[83.894,0.000,53.004]}},{"noteOn":{"time":39.750,"xyz":[-6.679,0.000,-27.820]}},{"noteOn":{"time":39.875,"xyz":[69.834,0.000,44.146]}},{"noteOn":{"time":40.000,"xyz":[36.938,0.000,-60.696]}},{"noteOn":{"time":40.125,"xyz":[85.146,0.000,23.358]}},{"noteOn":{"time":40.250,"xyz":[-53.730,0.000,-31.550]}},{"noteOn":{"time":40.375,"xyz":[96.106,0.000,-80.304]}},{"noteOn":{"time":40.500,"xyz":[-64.099,0.000,41.019]}},{"noteOn":{"time":40.625,"xyz":[-80.434,0.000,-85.613]}},{"noteOn":{"time":40.750,"xyz":[-3.870,0.000,58.913]}},{"noteOn":{"time":40.875,"xyz":[-12.064,0.000,83.398]}},{"noteOn":{"time":41.000,"xyz":[86.958,0.000,-99.908]}},{"noteOn":{"time":41.125,"xyz":[87.008,0.000,-78.551]}},{"noteOn":{"time":41.250,"xyz":[-59.146,0.000,47.756]}},{"noteOn":{"time":41.375,"xyz":[-98.981,0.000,44.338]}},{"noteOn":{"time":41.500,"xyz":[-66.303,0.000,15.049]}},{"noteOn":{"time":41.625,"xyz":[49.303,0.000,16.476]}},{"noteOn":{"time":41.750,"xyz":[-66.758,0.000,37.127]}},{"noteOn":{"time":41.875,"xyz":[-51.074,0.000,-99.521]}},{"noteOn":{"time":42.000,"xyz":[84.514,0.000,-47.501]}},{"noteOn":{"time":42.125,"xyz":[87.676,0.000,-24.289]}},{"noteOn":{"time":42.250,"xyz":[-58.515,0.000,45.494]}},{"noteOn":{"time":42.375,"xyz":[-58.230,0.000,-77.352]}},{"noteOn":{"time":42.500,"xyz":[4.411,0.000,71.737]}},{"noteOn":{"time":42.625,"xyz":[22.673,0.000,19.938]}},{"noteOn":{"time":42.750,"xyz":[-27.783,0.000,-61.493]}},{"noteOn":{"time":42.875,"xyz":[-12.615,0.000,-48.977]}},{"noteOn":{"time":43.000,"xyz":[69.289,0.000,-38.145]}},{"noteOn":{"time":43.125,"xyz":[-3.418,0.000,67.220]}},{"noteOn":{"time":43.250,"xyz":[56.058,0.000,72.353]}},{"noteOn":{"time":43.375,"xyz":[-45.010,0.000,4.111]}},{"noteOn":{"time":43.500,"xyz":[-17.253,0.000,-8.647]}},{"noteOn":{"time":43.625,"xyz":[-81.650,0.000,-1.867]}},{"noteOn":{"time":43.750,"xyz":[-4.341,0.000,49.622]}},{"noteOn":{"time":43.875,"xyz":[1.368,0.000,-99.762]}},{"noteOn":{"time":44.000,"xyz":[-44.622,0.000,-29.754]}},{"noteOn":{"time":44.125,"xyz":[-28.989,0.000,-66.502]}},{"noteOn":{"time":44.250,"xyz":[76.256,0.000,-12.342]}},{"noteOn":{"time":44.375,"xyz":[-40.466,0.000,91.531]}},{"noteOn":{"time":44.500,"xyz":[46.569,0.000,-75.325]}},{"noteOn":{"time":44.625,"xyz":[-18.395,0.000,-75.381]}},{"noteOn":{"time":44.750,"xyz":[-61.291,0.000,99.425]}},{"noteOn":{"time":44.875,"xyz":[-10.092,0.000,-89.598]}},{"noteOn":{"time":45.000,"xyz":[68.792,0.000,-15.983]}},{"noteOn":{"time":45.125,"xyz":[53.599,0.000,56.012]}},{"noteOn":{"time":45.250,"xyz":[15.053,0.000,-13.137]}},{"noteOn":{"time":45.375,"xyz":[93.986,0.000,28.533]}},{"noteOn":{"time":45.500,"xyz":[54.407,0.000,-19.509]}},{"noteOn":{"time":45.625,"xyz":[61.812,0.000,-39.353]}},{"noteOn":{"time":45.750,"xyz":[-73.454,0.000,46.750]}},{"noteOn":{"time":45.875,"xyz":[90.514,0.000,-71.639]}},{"noteOn":{"time":46.000,"xyz":[84.954,0.000,-38.730]}},{"noteOn":{"time":46.125,"xyz":[9.834,0.000,-52.326]}},{"noteOn":{"time":46.250,"xyz":[44.211,0.000,-10.942]}},{"noteOn":{"time":46.375,"xyz":[54.156,0.000,-12.938]}},{"noteOn":{"time":46.500,"xyz":[82.955,0.000,13.093]}},{"noteOn":{"time":46.625,"xyz":[49.948,0.000,-57.336]}},{"noteOn":{"time":46.750,"xyz":[11.889,0.000,67.815]}},{"noteOn":{"time":46.875,"xyz":[16.672,0.000,-26.966]}},{"noteOn":{"time":63.000,"xyz":[-18.836,0.000,37.596]}},{"noteOn":{"time":63.125,"xyz":[-54.342,0.000,-78.712]}},{"noteOn":{"time":63.250,"xyz":[66.191,0.000,-31.879]}},{"noteOn":{"time":63.375,"xyz":[51.171,0.000,-32.449]}},{"noteOn":{"time":63.500,"xyz":[-7.684,0.000,-53.366]}},{"noteOn":{"time":63.625,"xyz":[-45.707,0.000,-10.972]}},{"noteOn":{"time":63.750,"xyz":[38.558,0.000,63.384]}},{"noteOn":{"time":63.875,"xyz":[79.477,0.000,58.023]}},{"noteOn":{"time":64.000,"xyz":[-84.813,0.000,69.541]}},{"noteOn":{"time":64.125,"xyz":[-66.351,0.000,-81.063]}},{"noteOn":{"time":64.250,"xyz":[-17.940,0.000,-94.200]}},{"noteOn":{"time":64.375,"xyz":[-42.333,0.000,-78.586]}},{"noteOn":{"time":64.500,"xyz":[-17.410,0.000,87.963]}},{"noteOn":{"time":64.625,"xyz":[17.030,0.000,35.705]}},{"noteOn":{"time":64.750,"xyz":[-3.331,0.000,35.687]}},{"noteOn":{"time":64.875,"xyz":[-96.279,0.000,34.642]}},{"noteOn":{"time":65.000,"xyz":[-90.603,0.000,53.772]}},{"noteOn":{"time":65.125,"xyz":[71.057,0.000,-23.417]}},{"noteOn":{"time":65.250,"xyz":[-57.474,0.000,-74.641]}},{"noteOn":{"time":65.375,"xyz":[73.425,0.000,-26.290]}},{"noteOn":{"time":65.500,"xyz":[45.452,0.000,-73.579]}},{"noteOn":{"time":65.625,"xyz":[32.772,0.000,80.055]}},{"noteOn":{"time":65.750,"xyz":[-7.326,0.000,-79.081]}},{"noteOn":{"time":65.875,"xyz":[-96.270,0.000,-16.374]}},{"noteOn":{"time":66.000,"xyz":[84.556,0.000,45.990]}},{"noteOn":{"time":66.125,"xyz":[-40.752,0.000,37.009]}},{"noteOn":{"time":66.250,"xyz":[-1.706,0.000,-53.441]}},{"noteOn":{"time":66.375,"xyz":[-31.391,0.000,10.825]}},{"noteOn":{"time":66.500,"xyz":[-14.048,0.000,-31.267]}},{"noteOn":{"time":66.625,"xyz":[-10.299,0.000,4.410]}},{"noteOn":{"time":66.750,"xyz":[66.439,0.000,-28.642]}},{"noteOn":{"time":66.875,"xyz":[-52.579,0.000,-1.903]}},{"noteOn":{"time":67.000,"xyz":[-91.689,0.000,65.124]}},{"noteOn":{"time":67.125,"xyz":[20.094,0.000,-18.527]}},{"noteOn":{"time":67.250,"xyz":[-49.734,0.000,38.575]}},{"noteOn":{"time":67.375,"xyz":[-94.235,0.000,41.998]}},{"noteOn":{"time":67.500,"xyz":[-43.789,0.000,80.409]}},{"noteOn":{"time":67.625,"xyz":[90.254,0.000,48.332]}},{"noteOn":{"time":67.750,"xyz":[51.774,0.000,57.448]}},{"noteOn":{"time":67.875,"xyz":[88.843,0.000,12.782]}},{"noteOn":{"time":68.000,"xyz":[-60.870,0.000,57.644]}},{"noteOn":{"time":68.125,"xyz":[83.474,0.000,67.212]}},{"noteOn":{"time":68.250,"xyz":[37.036,0.000,-42.506]}},{"noteOn":{"time":68.375,"xyz":[27.320,0.000,36.816]}},{"noteOn":{"time":68.500,"xyz":[-57.079,0.000,23.251]}},{"noteOn":{"time":68.625,"xyz":[-61.373,0.000,46.106]}},{"noteOn":{"time":68.750,"xyz":[63.934,0.000,5.298]}},{"noteOn":{"time":68.875,"xyz":[-44.320,0.000,41.508]}},{"noteOn":{"time":69.000,"xyz":[-86.196,0.000,35.058]}},{"noteOn":{"time":69.125,"xyz":[-25.225,0.000,-35.062]}},{"noteOn":{"time":69.250,"xyz":[22.395,0.000,83.818]}},{"noteOn":{"time":69.375,"xyz":[-56.914,0.000,-37.278]}},{"noteOn":{"time":69.500,"xyz":[54.843,0.000,-7.151]}},{"noteOn":{"time":69.625,"xyz":[-71.724,0.000,64.245]}},{"noteOn":{"time":69.750,"xyz":[-12.878,0.000,-65.822]}},{"noteOn":{"time":69.875,"xyz":[-63.255,0.000,14.705]}},{"noteOn":{"time":70.000,"xyz":[34.940,0.000,11.412]}},{"noteOn":{"time":70.125,"xyz":[-97.606,0.000,-3.661]}},{"noteOn":{"time":70.250,"xyz":[82.830,0.000,-40.035]}},{"noteOn":{"time":70.375,"xyz":[-82.242,0.000,22.506]}},{"noteOn":{"time":70.500,"xyz":[10.309,0.000,-43.918]}},{"noteOn":{"time":70.625,"xyz":[29.411,0.000,38.989]}},{"noteOn":{"time":70.750,"xyz":[-38.017,0.000,-5.975]}},{"noteOn":{"time":70.875,"xyz":[-30.512,0.000,16.902]}},{"noteOn":{"time":71.000,"xyz":[58.469,0.000,-59.207]}},{"noteOn":{"time":71.125,"xyz":[45.233,0.000,-28.418]}},{"noteOn":{"time":71.250,"xyz":[95.022,0.000,27.764]}},{"noteOn":{"time":71.375,"xyz":[58.413,0.000,91.814]}},{"noteOn":{"time":71.500,"xyz":[24.722,0.000,-11.380]}},{"noteOn":{"time":71.625,"xyz":[-23.499,0.000,13.804]}},{"noteOn":{"time":71.750,"xyz":[73.108,0.000,-97.061]}},{"noteOn":{"time":71.875,"xyz":[-72.511,0.000,-75.766]}},{"noteOn":{"time":72.000,"xyz":[-18.859,0.000,54.827]}},{"noteOn":{"time":72.125,"xyz":[-59.797,0.000,26.807]}},{"noteOn":{"time":72.250,"xyz":[-76.652,0.000,-34.040]}},{"noteOn":{"time":72.375,"xyz":[-97.991,0.000,-43.359]}},{"noteOn":{"time":72.500,"xyz":[98.053,0.000,12.418]}},{"noteOn":{"time":72.625,"xyz":[55.776,0.000,-23.117]}},{"noteOn":{"time":72.750,"xyz":[36.536,0.000,84.684]}},{"noteOn":{"time":72.875,"xyz":[7.962,0.000,41.932]}},{"noteOn":{"time":73.000,"xyz":[-71.975,0.000,0.178]}},{"noteOn":{"time":73.125,"xyz":[69.723,0.000,61.634]}},{"noteOn":{"time":73.250,"xyz":[-92.619,0.000,27.712]}},{"noteOn":{"time":73.375,"xyz":[2.891,0.000,-49.166]}},{"noteOn":{"time":73.500,"xyz":[-97.654,0.000,-66.776]}},{"noteOn":{"time":73.625,"xyz":[92.719,0.000,98.646]}},{"noteOn":{"time":73.750,"xyz":[87.247,0.000,6.188]}},{"noteOn":{"time":73.875,"xyz":[-80.746,0.000,-58.168]}},{"noteOn":{"time":74.000,"xyz":[40.012,0.000,-23.950]}},{"noteOn":{"time":74.125,"xyz":[49.220,0.000,-23.342]}},{"noteOn":{"time":74.250,"xyz":[-50.614,0.000,-21.908]}},{"noteOn":{"time":74.375,"xyz":[-79.717,0.000,-6.409]}},{"noteOn":{"time":74.500,"xyz":[69.213,0.000,-21.927]}},{"noteOn":{"time":74.625,"xyz":[39.574,0.000,-30.763]}},{"noteOn":{"time":74.750,"xyz":[66.670,0.000,-84.958]}},{"noteOn":{"time":74.875,"xyz":[68.344,0.000,99.872]}},{"noteOn":{"time":75.000,"xyz":[-38.686,0.000,71.684]}},{"noteOn":{"time":75.125,"xyz":[14.629,0.000,-89.051]}},{"noteOn":{"time":75.250,"xyz":[1.828,0.000,31.587]}},{"noteOn":{"time":75.375,"xyz":[5.794,0.000,26.962]}},{"noteOn":{"time":75.500,"xyz":[77.339,0.000,32.790]}},{"noteOn":{"time":75.625,"xyz":[-37.158,0.000,36.030]}},{"noteOn":{"time":75.750,"xyz":[-89.822,0.000,-22.996]}},{"noteOn":{"time":75.875,"xyz":[-51.656,0.000,-66.410]}},{"noteOn":{"time":76.000,"xyz":[-73.039,0.000,3.864]}},{"noteOn":{"time":76.125,"xyz":[9.890,0.000,79.558]}},{"noteOn":{"time":76.250,"xyz":[-45.136,0.000,-10.402]}},{"noteOn":{"time":76.375,"xyz":[-9.085,0.000,53.350]}},{"noteOn":{"time":76.500,"xyz":[-60.023,0.000,-20.511]}},{"noteOn":{"time":76.625,"xyz":[30.781,0.000,41.124]}},{"noteOn":{"time":76.750,"xyz":[-65.411,0.000,13.494]}},{"noteOn":{"time":76.875,"xyz":[-74.001,0.000,39.625]}},{"noteOn":{"time":77.000,"xyz":[50.304,0.000,54.408]}},{"noteOn":{"time":77.125,"xyz":[-25.544,0.000,11.007]}},{"noteOn":{"time":77.250,"xyz":[-76.152,0.000,-22.061]}},{"noteOn":{"time":77.375,"xyz":[-25.481,0.000,-26.993]}},{"noteOn":{"time":77.500,"xyz":[92.452,0.000,34.071]}},{"noteOn":{"time":77.625,"xyz":[-99.093,0.000,58.844]}},{"noteOn":{"time":77.750,"xyz":[-74.334,0.000,39.095]}},{"noteOn":{"time":77.875,"xyz":[29.187,0.000,31.220]}},{"noteOn":{"time":78.000,"xyz":[10.515,0.000,7.678]}},{"noteOn":{"time":78.125,"xyz":[-69.217,0.000,-15.200]}},{"noteOn":{"time":78.250,"xyz":[-63.171,0.000,-15.660]}},{"noteOn":{"time":78.375,"xyz":[10.364,0.000,21.539]}},{"noteOn":{"time":78.500,"xyz":[79.656,0.000,83.729]}},{"noteOn":{"time":78.625,"xyz":[-92.504,0.000,-66.758]}},{"noteOn":{"time":78.750,"xyz":[25.619,0.000,-0.943]}},{"noteOn":{"time":78.875,"xyz":[-65.581,0.000,-24.283]}},{"noteOn":{"time":79.000,"xyz":[-59.913,0.000,88.071]}},{"noteOn":{"time":79.125,"xyz":[-28.163,0.000,68.912]}},{"noteOn":{"time":79.250,"xyz":[22.050,0.000,-4.058]}},{"noteOn":{"time":79.375,"xyz":[94.589,0.000,7.402]}},{"noteOn":{"time":79.500,"xyz":[43.556,0.000,24.444]}},{"noteOn":{"time":79.625,"xyz":[49.079,0.000,-84.403]}},{"noteOn":{"time":79.750,"xyz":[20.601,0.000,-93.208]}},{"noteOn":{"time":79.875,"xyz":[-45.662,0.000,32.061]}},{"noteOn":{"time":80.000,"xyz":[-87.668,0.000,97.527]}},{"noteOn":{"time":80.125,"xyz":[48.591,0.000,-42.700]}},{"noteOn":{"time":80.250,"xyz":[95.451,0.000,-63.195]}},{"noteOn":{"time":80.375,"xyz":[-46.784,0.000,-50.597]}},{"noteOn":{"time":80.500,"xyz":[10.687,0.000,98.485]}},{"noteOn":{"time":80.625,"xyz":[-24.054,0.000,-98.086]}},{"noteOn":{"time":80.750,"xyz":[28.212,0.000,-18.624]}},{"noteOn":{"time":80.875,"xyz":[25.219,0.000,88.299]}},{"noteOn":{"time":81.000,"xyz":[28.882,0.000,-46.979]}},{"noteOn":{"time":81.125,"xyz":[-42.472,0.000,7.394]}},{"noteOn":{"time":81.250,"xyz":[48.166,0.000,5.398]}},{"noteOn":{"time":81.375,"xyz":[29.650,0.000,-85.797]}},{"noteOn":{"time":81.500,"xyz":[-20.347,0.000,31.912]}},{"noteOn":{"time":81.625,"xyz":[-22.355,0.000,70.425]}},{"noteOn":{"time":81.750,"xyz":[-15.003,0.000,-14.950]}},{"noteOn":{"time":81.875,"xyz":[94.474,0.000,-0.922]}},{"noteOn":{"time":82.000,"xyz":[-92.809,0.000,24.069]}},{"noteOn":{"time":82.125,"xyz":[-71.864,0.000,77.601]}},{"noteOn":{"time":82.250,"xyz":[34.026,0.000,12.106]}},{"noteOn":{"time":82.375,"xyz":[72.180,0.000,53.813]}},{"noteOn":{"time":82.500,"xyz":[8.630,0.000,-27.927]}},{"noteOn":{"time":82.625,"xyz":[-29.519,0.000,-80.911]}},{"noteOn":{"time":82.750,"xyz":[-66.054,0.000,-39.281]}},{"noteOn":{"time":82.875,"xyz":[-91.858,0.000,23.147]}},{"noteOn":{"time":83.000,"xyz":[-31.969,0.000,70.227]}},{"noteOn":{"time":83.125,"xyz":[10.411,0.000,-35.194]}},{"noteOn":{"time":83.250,"xyz":[-42.945,0.000,-83.271]}},{"noteOn":{"time":83.375,"xyz":[-78.524,0.000,43.094]}},{"noteOn":{"time":83.500,"xyz":[-97.135,0.000,25.104]}},{"noteOn":{"time":83.625,"xyz":[85.018,0.000,-96.910]}},{"noteOn":{"time":83.750,"xyz":[-88.006,0.000,-30.549]}},{"noteOn":{"time":83.875,"xyz":[-1.601,0.000,60.859]}},{"noteOn":{"time":84.000,"xyz":[-77.003,0.000,-21.410]}},{"noteOn":{"time":84.125,"xyz":[62.360,0.000,41.870]}},{"noteOn":{"time":84.250,"xyz":[-41.025,0.000,-34.020]}},{"noteOn":{"time":84.375,"xyz":[98.092,0.000,-82.738]}},{"noteOn":{"time":84.500,"xyz":[-97.827,0.000,-6.568]}},{"noteOn":{"time":84.625,"xyz":[53.577,0.000,72.339]}},{"noteOn":{"time":84.750,"xyz":[37.522,0.000,27.980]}},{"noteOn":{"time":84.875,"xyz":[71.053,0.000,91.664]}},{"noteOn":{"time":85.000,"xyz":[62.002,0.000,-98.711]}},{"noteOn":{"time":85.125,"xyz":[-62.506,0.000,95.129]}},{"noteOn":{"time":85.250,"xyz":[-93.299,0.000,30.986]}},{"noteOn":{"time":85.375,"xyz":[-10.036,0.000,-90.618]}},{"noteOn":{"time":85.500,"xyz":[-31.558,0.000,-86.728]}},{"noteOn":{"time":85.625,"xyz":[-2.264,0.000,-91.024]}},{"noteOn":{"time":85.750,"xyz":[-2.144,0.000,46.201]}},{"noteOn":{"time":85.875,"xyz":[-6.957,0.000,11.617]}},{"noteOn":{"time":86.000,"xyz":[-59.219,0.000,-7.003]}},{"noteOn":{"time":86.125,"xyz":[72.334,0.000,-38.102]}},{"noteOn":{"time":86.250,"xyz":[79.844,0.000,-55.211]}},{"noteOn":{"time":86.375,"xyz":[39.911,0.000,87.872]}},{"noteOn":{"time":86.500,"xyz":[73.127,0.000,-7.872]}},{"noteOn":{"time":86.625,"xyz":[15.833,0.000,-35.136]}},{"noteOn":{"time":86.750,"xyz":[-63.232,0.000,-35.324]}},{"noteOn":{"time":86.875,"xyz":[-20.056,0.000,70.875]}},{"noteOn":{"time":87.000,"xyz":[68.388,0.000,-51.574]}},{"noteOn":{"time":87.125,"xyz":[73.908,0.000,-32.033]}},{"noteOn":{"time":87.250,"xyz":[58.212,0.000,39.844]}},{"noteOn":{"time":87.375,"xyz":[-66.864,0.000,-6.000]}},{"noteOn":{"time":87.500,"xyz":[84.757,0.000,-53.706]}},{"noteOn":{"time":87.625,"xyz":[-29.537,0.000,99.095]}},{"noteOn":{"time":87.750,"xyz":[-58.026,0.000,92.130]}},{"noteOn":{"time":87.875,"xyz":[-16.541,0.000,-88.807]}},{"noteOn":{"time":88.000,"xyz":[-5.302,0.000,-60.174]}},{"noteOn":{"time":88.125,"xyz":[-92.749,0.000,-34.897]}},{"noteOn":{"time":88.250,"xyz":[9.305,0.000,85.521]}},{"noteOn":{"time":88.375,"xyz":[-15.277,0.000,79.388]}},{"noteOn":{"time":88.500,"xyz":[56.429,0.000,-61.648]}},{"noteOn":{"time":88.625,"xyz":[75.977,0.000,-84.514]}},{"noteOn":{"time":88.750,"xyz":[-67.364,0.000,42.952]}},{"noteOn":{"time":88.875,"xyz":[78.930,0.000,3.431]}},{"noteOn":{"time":89.000,"xyz":[-2.094,0.000,-45.514]}},{"noteOn":{"time":89.125,"xyz":[82.909,0.000,-31.451]}},{"noteOn":{"time":89.250,"xyz":[-24.180,0.000,25.603]}},{"noteOn":{"time":89.375,"xyz":[-72.860,0.000,-56.494]}},{"noteOn":{"time":89.500,"xyz":[-86.690,0.000,-85.326]}},{"noteOn":{"time":89.625,"xyz":[85.986,0.000,0.082]}},{"noteOn":{"time":89.750,"xyz":[-53.138,0.000,74.695]}},{"noteOn":{"time":89.875,"xyz":[52.826,0.000,85.049]}},{"noteOn":{"time":90.000,"xyz":[-27.972,0.000,-67.764]}},{"noteOn":{"time":90.125,"xyz":[44.432,0.000,-5.474]}},{"noteOn":{"time":90.250,"xyz":[-36.849,0.000,-84.212]}},{"noteOn":{"time":90.375,"xyz":[97.737,0.000,-28.821]}},{"noteOn":{"time":90.500,"xyz":[-59.860,0.000,-57.081]}},{"noteOn":{"time":90.625,"xyz":[80.858,0.000,-41.347]}},{"noteOn":{"time":90.750,"xyz":[29.203,0.000,25.576]}},{"noteOn":{"time":90.875,"xyz":[-9.747,0.000,-2.390]}},{"noteOn":{"time":91.000,"xyz":[-85.600,0.000,-97.059]}},{"noteOn":{"time":91.125,"xyz":[-44.120,0.000,97.731]}},{"noteOn":{"time":91.250,"xyz":[26.886,0.000,61.188]}},{"noteOn":{"time":91.375,"xyz":[26.248,0.000,-29.919]}},{"noteOn":{"time":91.500,"xyz":[68.725,0.000,-50.462]}},{"noteOn":{"time":91.625,"xyz":[55.219,0.000,54.198]}},{"noteOn":{"time":91.750,"xyz":[-81.842,0.000,51.977]}},{"noteOn":{"time":91.875,"xyz":[62.447,0.000,-75.725]}},{"noteOn":{"time":92.000,"xyz":[13.177,0.000,-75.990]}},{"noteOn":{"time":92.125,"xyz":[89.320,0.000,8.835]}},{"noteOn":{"time":92.250,"xyz":[-39.694,0.000,-46.173]}},{"noteOn":{"time":92.375,"xyz":[22.288,0.000,8.240]}},{"noteOn":{"time":92.500,"xyz":[-34.554,0.000,57.269]}},{"noteOn":{"time":92.625,"xyz":[-94.547,0.000,44.439]}},{"noteOn":{"time":92.750,"xyz":[-66.329,0.000,-34.057]}},{"noteOn":{"time":92.875,"xyz":[-85.721,0.000,27.312]}},{"noteOn":{"time":93.000,"xyz":[-65.163,0.000,17.887]}},{"noteOn":{"time":93.125,"xyz":[12.327,0.000,-28.010]}},{"noteOn":{"time":93.250,"xyz":[-18.109,0.000,10.147]}},{"noteOn":{"time":93.375,"xyz":[-37.142,0.000,51.534]}},{"noteOn":{"time":93.500,"xyz":[-81.249,0.000,-77.360]}},{"noteOn":{"time":93.625,"xyz":[17.200,0.000,19.328]}},{"noteOn":{"time":93.750,"xyz":[64.630,0.000,-27.318]}},{"noteOn":{"time":93.875,"xyz":[51.751,0.000,85.585]}},{"noteOn":{"time":94.000,"xyz":[-88.325,0.000,-90.443]}},{"noteOn":{"time":94.125,"xyz":[-24.515,0.000,-17.678]}},{"noteOn":{"time":94.250,"xyz":[22.814,0.000,-91.499]}},{"noteOn":{"time":94.375,"xyz":[79.837,0.000,1.193]}},{"noteOn":{"time":94.500,"xyz":[-73.340,0.000,73.468]}},{"noteOn":{"time":94.625,"xyz":[52.861,0.000,38.542]}},{"noteOn":{"time":94.750,"xyz":[56.368,0.000,8.069]}},{"noteOn":{"time":94.875,"xyz":[29.500,0.000,-67.937]}},{"noteOn":{"time":95.000,"xyz":[29.309,0.000,-35.955]}},{"noteOn":{"time":95.125,"xyz":[99.883,0.000,23.433]}},{"noteOn":{"time":95.250,"xyz":[14.445,0.000,-73.343]}},{"noteOn":{"time":95.375,"xyz":[-52.508,0.000,-68.702]}},{"noteOn":{"time":95.500,"xyz":[-15.738,0.000,46.358]}},{"noteOn":{"time":95.625,"xyz":[-60.909,0.000,-31.015]}},{"noteOn":{"time":95.750,"xyz":[98.164,0.000,76.141]}},{"noteOn":{"time":95.875,"xyz":[38.292,0.000,91.317]}},{"noteOn":{"time":96.000,"xyz":[-85.823,0.000,-76.087]}},{"noteOn":{"time":96.125,"xyz":[-35.380,0.000,-95.097]}},{"noteOn":{"time":96.250,"xyz":[-24.153,0.000,79.297]}},{"noteOn":{"time":96.375,"xyz":[69.968,0.000,-73.718]}},{"noteOn":{"time":96.500,"xyz":[-28.783,0.000,-75.794]}},{"noteOn":{"time":96.625,"xyz":[54.308,0.000,-77.714]}},{"noteOn":{"time":96.750,"xyz":[-89.255,0.000,-13.401]}},{"noteOn":{"time":96.875,"xyz":[92.531,0.000,17.016]}},{"noteOn":{"time":97.000,"xyz":[21.035,0.000,46.763]}},{"noteOn":{"time":97.125,"xyz":[-5.696,0.000,99.788]}},{"noteOn":{"time":97.250,"xyz":[-98.720,0.000,55.516]}},{"noteOn":{"time":97.375,"xyz":[68.797,0.000,-81.571]}},{"noteOn":{"time":97.500,"xyz":[-60.744,0.000,73.695]}},{"noteOn":{"time":97.625,"xyz":[16.182,0.000,92.302]}},{"noteOn":{"time":97.750,"xyz":[33.778,0.000,92.309]}},{"noteOn":{"time":97.875,"xyz":[17.749,0.000,-70.565]}},{"noteOn":{"time":98.000,"xyz":[-79.537,0.000,42.737]}},{"noteOn":{"time":98.125,"xyz":[46.547,0.000,-17.879]}},{"noteOn":{"time":98.250,"xyz":[47.700,0.000,-43.674]}},{"noteOn":{"time":98.375,"xyz":[70.392,0.000,-74.624]}},{"noteOn":{"time":98.500,"xyz":[-0.320,0.000,82.799]}},{"noteOn":{"time":98.625,"xyz":[69.144,0.000,-7.383]}},{"noteOn":{"time":98.750,"xyz":[-86.621,0.000,26.802]}},{"noteOn":{"time":98.875,"xyz":[38.114,0.000,52.947]}},{"noteOn":{"time":99.000,"xyz":[-13.642,0.000,12.013]}},{"noteOn":{"time":99.125,"xyz":[-0.529,0.000,64.411]}},{"noteOn":{"time":99.250,"xyz":[22.256,0.000,32.151]}},{"noteOn":{"time":99.375,"xyz":[93.547,0.000,87.611]}},{"noteOn":{"time":99.500,"xyz":[10.859,0.000,98.279]}},{"noteOn":{"time":99.625,"xyz":[71.884,0.000,94.042]}},{"noteOn":{"time":99.750,"xyz":[-10.391,0.000,41.769]}},{"noteOn":{"time":99.875,"xyz":[-36.075,0.000,53.528]}},{"noteOn":{"time":100.000,"xyz":[83.439,0.000,-17.689]}},{"noteOn":{"time":100.125,"xyz":[-60.792,0.000,35.143]}},{"noteOn":{"time":100.250,"xyz":[69.794,0.000,20.328]}},{"noteOn":{"time":100.375,"xyz":[36.942,0.000,-94.028]}},{"noteOn":{"time":100.500,"xyz":[65.734,0.000,-36.814]}},{"noteOn":{"time":100.625,"xyz":[84.847,0.000,62.111]}},{"noteOn":{"time":100.750,"xyz":[-16.026,0.000,-55.430]}},{"noteOn":{"time":100.875,"xyz":[-20.885,0.000,76.256]}},{"noteOn":{"time":101.000,"xyz":[54.745,0.000,46.390]}},{"noteOn":{"time":101.125,"xyz":[-52.607,0.000,-3.721]}},{"noteOn":{"time":101.250,"xyz":[-39.645,0.000,82.610]}},{"noteOn":{"time":101.375,"xyz":[66.638,0.000,79.151]}},{"noteOn":{"time":101.500,"xyz":[-20.682,0.000,-45.638]}},{"noteOn":{"time":101.625,"xyz":[-42.264,0.000,-5.411]}},{"noteOn":{"time":101.750,"xyz":[-13.077,0.000,35.726]}},{"noteOn":{"time":101.875,"xyz":[28.749,0.000,-17.190]}},{"noteOn":{"time":102.000,"xyz":[9.134,0.000,99.546]}},{"noteOn":{"time":102.125,"xyz":[88.673,0.000,-99.240]}},{"noteOn":{"time":102.250,"xyz":[76.675,0.000,-57.337]}},{"noteOn":{"time":102.375,"xyz":[3.580,0.000,-58.811]}},{"noteOn":{"time":102.500,"xyz":[-23.808,0.000,-80.065]}},{"noteOn":{"time":102.625,"xyz":[-82.985,0.000,58.964]}},{"noteOn":{"time":102.750,"xyz":[-54.645,0.000,46.423]}},{"noteOn":{"time":102.875,"xyz":[6.525,0.000,-11.029]}},{"noteOn":{"time":103.000,"xyz":[8.788,0.000,-22.884]}},{"noteOn":{"time":103.125,"xyz":[-1.800,0.000,-10.001]}},{"noteOn":{"time":103.250,"xyz":[-98.314,0.000,23.568]}},{"noteOn":{"time":103.375,"xyz":[-88.906,0.000,98.982]}},{"noteOn":{"time":103.500,"xyz":[-21.992,0.000,16.823]}},{"noteOn":{"time":103.625,"xyz":[-46.598,0.000,-70.046]}},{"noteOn":{"time":103.750,"xyz":[-49.890,0.000,76.011]}},{"noteOn":{"time":103.875,"xyz":[-57.726,0.000,-97.880]}},{"noteOn":{"time":104.000,"xyz":[-43.295,0.000,-8.024]}},{"noteOn":{"time":104.125,"xyz":[69.136,0.000,31.389]}},{"noteOn":{"time":104.250,"xyz":[-93.985,0.000,-14.681]}},{"noteOn":{"time":104.375,"xyz":[82.390,0.000,69.773]}},{"noteOn":{"time":104.500,"xyz":[90.989,0.000,48.234]}},{"noteOn":{"time":104.625,"xyz":[9.374,0.000,27.001]}},{"noteOn":{"time":104.750,"xyz":[-76.525,0.000,-70.496]}},{"noteOn":{"time":104.875,"xyz":[-10.540,0.000,-41.258]}},{"noteOn":{"time":105.000,"xyz":[84.206,0.000,72.039]}},{"noteOn":{"time":105.125,"xyz":[40.150,0.000,-44.201]}},{"noteOn":{"time":105.250,"xyz":[35.483,0.000,62.325]}},{"noteOn":{"time":105.375,"xyz":[28.061,0.000,-81.339]}},{"noteOn":{"time":105.500,"xyz":[93.428,0.000,1.164]}},{"noteOn":{"time":105.625,"xyz":[-33.332,0.000,-48.226]}},{"noteOn":{"time":105.750,"xyz":[-93.317,0.000,55.080]}},{"noteOn":{"time":105.875,"xyz":[12.680,0.000,61.921]}},{"noteOn":{"time":106.000,"xyz":[38.432,0.000,97.760]}},{"noteOn":{"time":106.125,"xyz":[-17.083,0.000,95.073]}},{"noteOn":{"time":106.250,"xyz":[-1.392,0.000,0.908]}},{"noteOn":{"time":106.375,"xyz":[63.582,0.000,96.093]}},{"noteOn":{"time":106.500,"xyz":[-76.812,0.000,-16.100]}},{"noteOn":{"time":106.625,"xyz":[33.776,0.000,-74.331]}},{"noteOn":{"time":106.750,"xyz":[-52.588,0.000,81.582]}},{"noteOn":{"time":106.875,"xyz":[-24.838,0.000,18.846]}},{"noteOn":{"time":107.000,"xyz":[-30.158,0.000,39.630]}},{"noteOn":{"time":107.125,"xyz":[89.624,0.000,19.534]}},{"noteOn":{"time":107.250,"xyz":[-45.896,0.000,-3.194]}},{"noteOn":{"time":107.375,"xyz":[96.811,0.000,75.371]}},{"noteOn":{"time":107.500,"xyz":[-34.798,0.000,-36.486]}},{"noteOn":{"time":107.625,"xyz":[-66.551,0.000,27.309]}},{"noteOn":{"time":107.750,"xyz":[-12.716,0.000,-43.985]}},{"noteOn":{"time":107.875,"xyz":[-73.730,0.000,-21.697]}},{"noteOn":{"time":108.000,"xyz":[19.719,0.000,95.681]}},{"noteOn":{"time":108.125,"xyz":[60.461,0.000,-24.521]}},{"noteOn":{"time":108.250,"xyz":[-1.623,0.000,32.669]}},{"noteOn":{"time":108.375,"xyz":[15.491,0.000,-9.855]}},{"noteOn":{"time":108.500,"xyz":[-61.026,0.000,-96.628]}},{"noteOn":{"time":108.625,"xyz":[90.196,0.000,30.042]}},{"noteOn":{"time":108.750,"xyz":[-50.633,0.000,81.050]}},{"noteOn":{"time":108.875,"xyz":[-11.003,0.000,68.184]}},{"noteOn":{"time":109.000,"xyz":[7.663,0.000,28.985]}},{"noteOn":{"time":109.125,"xyz":[91.129,0.000,-77.317]}},{"noteOn":{"time":109.250,"xyz":[53.031,0.000,15.561]}},{"noteOn":{"time":109.375,"xyz":[74.743,0.000,71.919]}},{"noteOn":{"time":109.500,"xyz":[-13.921,0.000,-99.375]}},{"noteOn":{"time":109.625,"xyz":[17.782,0.000,39.444]}},{"noteOn":{"time":109.750,"xyz":[25.675,0.000,52.521]}},{"noteOn":{"time":109.875,"xyz":[-52.527,0.000,32.980]}},{"noteOn":{"time":110.000,"xyz":[-80.903,0.000,-94.850]}},{"noteOn":{"time":110.125,"xyz":[60.335,0.000,-28.102]}},{"noteOn":{"time":110.250,"xyz":[-47.634,0.000,-85.538]}},{"noteOn":{"time":110.375,"xyz":[84.577,0.000,87.549]}},{"noteOn":{"time":110.500,"xyz":[-42.340,0.000,-76.283]}},{"noteOn":{"time":110.625,"xyz":[-93.267,0.000,-69.182]}},{"noteOn":{"time":110.750,"xyz":[-35.332,0.000,-3.074]}},{"noteOn":{"time":110.875,"xyz":[34.456,0.000,71.283]}},{"noteOn":{"time":127.000,"xyz":[-7.238,0.000,29.827]}},{"noteOn":{"time":127.125,"xyz":[22.351,0.000,54.946]}},{"noteOn":{"time":127.250,"xyz":[97.764,0.000,25.871]}},{"noteOn":{"time":127.375,"xyz":[-23.261,0.000,99.866]}},{"noteOn":{"time":127.500,"xyz":[-50.124,0.000,35.982]}},{"noteOn":{"time":127.625,"xyz":[-13.309,0.000,-69.792]}},{"noteOn":{"time":127.750,"xyz":[-91.071,0.000,35.759]}},{"noteOn":{"time":127.875,"xyz":[73.290,0.000,-54.238]}},{"noteOn":{"time":128.000,"xyz":[86.201,0.000,-54.580]}},{"noteOn":{"time":128.125,"xyz":[-0.752,0.000,-37.166]}},{"noteOn":{"time":128.250,"xyz":[70.775,0.000,36.925]}},{"noteOn":{"time":128.375,"xyz":[89.549,0.000,89.819]}},{"noteOn":{"time":128.500,"xyz":[-97.376,0.000,52.222]}},{"noteOn":{"time":128.625,"xyz":[-65.680,0.000,-43.901]}},{"noteOn":{"time":128.750,"xyz":[-11.145,0.000,92.009]}},{"noteOn":{"time":128.875,"xyz":[58.295,0.000,41.128]}},{"noteOn":{"time":129.000,"xyz":[72.501,0.000,-53.132]}},{"noteOn":{"time":129.125,"xyz":[91.268,0.000,-99.406]}},{"noteOn":{"time":129.250,"xyz":[13.216,0.000,-7.332]}},{"noteOn":{"time":129.375,"xyz":[23.888,0.000,-63.475]}},{"noteOn":{"time":129.500,"xyz":[-10.731,0.000,22.093]}},{"noteOn":{"time":129.625,"xyz":[-16.815,0.000,8.211]}},{"noteOn":{"time":129.750,"xyz":[-19.804,0.000,34.183]}},{"noteOn":{"time":129.875,"xyz":[12.197,0.000,30.828]}},{"noteOn":{"time":130.000,"xyz":[39.492,0.000,53.752]}},{"noteOn":{"time":130.125,"xyz":[-11.930,0.000,-41.372]}},{"noteOn":{"time":130.250,"xyz":[-83.279,0.000,-97.430]}},{"noteOn":{"time":130.375,"xyz":[63.017,0.000,-0.427]}},{"noteOn":{"time":130.500,"xyz":[38.409,0.000,94.175]}},{"noteOn":{"time":130.625,"xyz":[62.496,0.000,-41.707]}},{"noteOn":{"time":130.750,"xyz":[-92.895,0.000,74.191]}},{"noteOn":{"time":130.875,"xyz":[-75.005,0.000,54.241]}},{"noteOn":{"time":131.000,"xyz":[27.980,0.000,78.031]}},{"noteOn":{"time":131.125,"xyz":[-82.213,0.000,11.909]}},{"noteOn":{"time":131.250,"xyz":[-77.659,0.000,-72.141]}},{"noteOn":{"time":131.375,"xyz":[13.048,0.000,70.001]}},{"noteOn":{"time":131.500,"xyz":[37.432,0.000,-59.318]}},{"noteOn":{"time":131.625,"xyz":[58.687,0.000,6.417]}},{"noteOn":{"time":131.750,"xyz":[11.902,0.000,-30.548]}},{"noteOn":{"time":131.875,"xyz":[28.290,0.000,-74.062]}},{"noteOn":{"time":132.000,"xyz":[6.308,0.000,49.048]}},{"noteOn":{"time":132.125,"xyz":[84.531,0.000,7.480]}},{"noteOn":{"time":132.250,"xyz":[58.037,0.000,-30.980]}},{"noteOn":{"time":132.375,"xyz":[40.446,0.000,57.791]}},{"noteOn":{"time":132.500,"xyz":[70.013,0.000,-55.039]}},{"noteOn":{"time":132.625,"xyz":[52.920,0.000,-31.529]}},{"noteOn":{"time":132.750,"xyz":[92.569,0.000,10.393]}},{"noteOn":{"time":132.875,"xyz":[32.784,0.000,23.187]}},{"noteOn":{"time":133.000,"xyz":[7.860,0.000,1.029]}},{"noteOn":{"time":133.125,"xyz":[-94.111,0.000,51.954]}},{"noteOn":{"time":133.250,"xyz":[-23.811,0.000,53.295]}},{"noteOn":{"time":133.375,"xyz":[-90.473,0.000,79.371]}},{"noteOn":{"time":133.500,"xyz":[53.618,0.000,-11.009]}},{"noteOn":{"time":133.625,"xyz":[-41.417,0.000,-36.332]}},{"noteOn":{"time":133.750,"xyz":[40.254,0.000,7.949]}},{"noteOn":{"time":133.875,"xyz":[-34.218,0.000,-26.551]}},{"noteOn":{"time":134.000,"xyz":[68.558,0.000,-39.419]}},{"noteOn":{"time":134.125,"xyz":[50.425,0.000,99.014]}},{"noteOn":{"time":134.250,"xyz":[91.086,0.000,-77.813]}},{"noteOn":{"time":134.375,"xyz":[19.958,0.000,-54.886]}},{"noteOn":{"time":134.500,"xyz":[77.001,0.000,40.884]}},{"noteOn":{"time":134.625,"xyz":[-41.210,0.000,-97.962]}},{"noteOn":{"time":134.750,"xyz":[-23.234,0.000,81.061]}},{"noteOn":{"time":134.875,"xyz":[8.690,0.000,-58.115]}},{"noteOn":{"time":135.000,"xyz":[-35.636,0.000,-65.803]}},{"noteOn":{"time":135.125,"xyz":[75.178,0.000,36.915]}},{"noteOn":{"time":135.250,"xyz":[-83.566,0.000,18.952]}},{"noteOn":{"time":135.375,"xyz":[44.258,0.000,46.839]}},{"noteOn":{"time":135.500,"xyz":[-62.295,0.000,-57.614]}},{"noteOn":{"time":135.625,"xyz":[-56.117,0.000,-28.067]}},{"noteOn":{"time":135.750,"xyz":[-7.918,0.000,44.180]}},{"noteOn":{"time":135.875,"xyz":[-65.486,0.000,-81.154]}},{"noteOn":{"time":136.000,"xyz":[-51.224,0.000,95.749]}},{"noteOn":{"time":136.125,"xyz":[63.166,0.000,-24.021]}},{"noteOn":{"time":136.250,"xyz":[2.853,0.000,76.109]}},{"noteOn":{"time":136.375,"xyz":[-34.702,0.000,45.307]}},{"noteOn":{"time":136.500,"xyz":[79.563,0.000,-3.626]}},{"noteOn":{"time":136.625,"xyz":[-51.071,0.000,-72.476]}},{"noteOn":{"time":136.750,"xyz":[81.840,0.000,-5.237]}},{"noteOn":{"time":136.875,"xyz":[-54.637,0.000,7.382]}},{"noteOn":{"time":137.000,"xyz":[90.336,0.000,-26.005]}},{"noteOn":{"time":137.125,"xyz":[60.883,0.000,-63.897]}},{"noteOn":{"time":137.250,"xyz":[75.377,0.000,-97.069]}},{"noteOn":{"time":137.375,"xyz":[-86.202,0.000,-42.271]}},{"noteOn":{"time":137.500,"xyz":[-69.803,0.000,-45.642]}},{"noteOn":{"time":137.625,"xyz":[-8.777,0.000,-23.696]}},{"noteOn":{"time":137.750,"xyz":[84.843,0.000,-99.223]}},{"noteOn":{"time":137.875,"xyz":[-90.052,0.000,-89.263]}},{"noteOn":{"time":138.000,"xyz":[10.122,0.000,40.074]}},{"noteOn":{"time":138.125,"xyz":[-84.202,0.000,-65.750]}},{"noteOn":{"time":138.250,"xyz":[-29.047,0.000,-27.050]}},{"noteOn":{"time":138.375,"xyz":[5.834,0.000,45.259]}},{"noteOn":{"time":138.500,"xyz":[38.515,0.000,3.982]}},{"noteOn":{"time":138.625,"xyz":[-92.215,0.000,66.584]}},{"noteOn":{"time":138.750,"xyz":[20.559,0.000,-11.806]}},{"noteOn":{"time":138.875,"xyz":[1.080,0.000,19.849]}},{"noteOn":{"time":139.000,"xyz":[19.251,0.000,95.008]}},{"noteOn":{"time":139.125,"xyz":[-86.141,0.000,71.955]}},{"noteOn":{"time":139.250,"xyz":[-24.057,0.000,11.457]}},{"noteOn":{"time":139.375,"xyz":[-19.669,0.000,-99.504]}},{"noteOn":{"time":139.500,"xyz":[12.220,0.000,-43.477]}},{"noteOn":{"time":139.625,"xyz":[-7.136,0.000,-25.002]}},{"noteOn":{"time":139.750,"xyz":[26.618,0.000,-71.503]}},{"noteOn":{"time":139.875,"xyz":[-66.826,0.000,-99.145]}},{"noteOn":{"time":140.000,"xyz":[56.379,0.000,57.203]}},{"noteOn":{"time":140.125,"xyz":[16.988,0.000,22.824]}},{"noteOn":{"time":140.250,"xyz":[-36.378,0.000,-17.002]}},{"noteOn":{"time":140.375,"xyz":[36.564,0.000,-65.015]}},{"noteOn":{"time":140.500,"xyz":[55.298,0.000,34.390]}},{"noteOn":{"time":140.625,"xyz":[35.432,0.000,-6.001]}},{"noteOn":{"time":140.750,"xyz":[96.316,0.000,26.174]}},{"noteOn":{"time":140.875,"xyz":[-0.257,0.000,-17.418]}},{"noteOn":{"time":141.000,"xyz":[25.203,0.000,-50.053]}},{"noteOn":{"time":141.125,"xyz":[-99.415,0.000,-79.967]}},{"noteOn":{"time":141.250,"xyz":[-68.320,0.000,78.880]}},{"noteOn":{"time":141.375,"xyz":[71.662,0.000,66.715]}},{"noteOn":{"time":141.500,"xyz":[-94.472,0.000,58.623]}},{"noteOn":{"time":141.625,"xyz":[-43.308,0.000,19.360]}},{"noteOn":{"time":141.750,"xyz":[16.112,0.000,6.222]}},{"noteOn":{"time":141.875,"xyz":[-89.095,0.000,44.058]}},{"noteOn":{"time":142.000,"xyz":[-68.043,0.000,88.910]}},{"noteOn":{"time":142.125,"xyz":[-8.973,0.000,43.827]}},{"noteOn":{"time":142.250,"xyz":[-60.278,0.000,-95.335]}},{"noteOn":{"time":142.375,"xyz":[-81.894,0.000,7.624]}},{"noteOn":{"time":142.500,"xyz":[-28.024,0.000,36.399]}},{"noteOn":{"time":142.625,"xyz":[47.568,0.000,37.674]}},{"noteOn":{"time":142.750,"xyz":[-96.870,0.000,1.646]}},{"noteOn":{"time":142.875,"xyz":[30.877,0.000,-97.998]}},{"noteOn":{"time":143.000,"xyz":[22.915,0.000,69.645]}},{"noteOn":{"time":143.125,"xyz":[-96.834,0.000,-90.977]}},{"noteOn":{"time":143.250,"xyz":[46.765,0.000,67.676]}},{"noteOn":{"time":143.375,"xyz":[-18.774,0.000,-48.910]}},{"noteOn":{"time":143.500,"xyz":[72.498,0.000,-51.476]}},{"noteOn":{"time":143.625,"xyz":[6.217,0.000,13.856]}},{"noteOn":{"time":143.750,"xyz":[-57.343,0.000,-59.042]}},{"noteOn":{"time":143.875,"xyz":[15.480,0.000,98.330]}},{"noteOn":{"time":144.000,"xyz":[-78.110,0.000,-44.910]}},{"noteOn":{"time":144.125,"xyz":[77.832,0.000,-47.493]}},{"noteOn":{"time":144.250,"xyz":[48.741,0.000,-35.509]}},{"noteOn":{"time":144.375,"xyz":[76.706,0.000,59.441]}},{"noteOn":{"time":144.500,"xyz":[-28.760,0.000,-63.061]}},{"noteOn":{"time":144.625,"xyz":[-24.484,0.000,-21.361]}},{"noteOn":{"time":144.750,"xyz":[-74.355,0.000,-64.320]}},{"noteOn":{"time":144.875,"xyz":[49.634,0.000,-12.346]}},{"noteOn":{"time":145.000,"xyz":[-32.267,0.000,63.064]}},{"noteOn":{"time":145.125,"xyz":[19.332,0.000,20.736]}},{"noteOn":{"time":145.250,"xyz":[15.996,0.000,-31.554]}},{"noteOn":{"time":145.375,"xyz":[68.080,0.000,-48.553]}},{"noteOn":{"time":145.500,"xyz":[-83.866,0.000,92.217]}},{"noteOn":{"time":145.625,"xyz":[-19.425,0.000,-83.921]}},{"noteOn":{"time":145.750,"xyz":[-13.790,0.000,67.838]}},{"noteOn":{"time":145.875,"xyz":[84.863,0.000,24.779]}},{"noteOn":{"time":146.000,"xyz":[-48.164,0.000,-46.232]}},{"noteOn":{"time":146.125,"xyz":[-67.054,0.000,57.238]}},{"noteOn":{"time":146.250,"xyz":[30.791,0.000,17.137]}},{"noteOn":{"time":146.375,"xyz":[-95.766,0.000,-10.175]}},{"noteOn":{"time":146.500,"xyz":[-23.595,0.000,41.063]}},{"noteOn":{"time":146.625,"xyz":[-33.775,0.000,51.050]}},{"noteOn":{"time":146.750,"xyz":[-60.870,0.000,-22.530]}},{"noteOn":{"time":146.875,"xyz":[76.791,0.000,52.209]}},{"noteOn":{"time":147.000,"xyz":[55.629,0.000,17.287]}},{"noteOn":{"time":147.125,"xyz":[-37.564,0.000,-9.891]}},{"noteOn":{"time":147.250,"xyz":[-75.201,0.000,-0.084]}},{"noteOn":{"time":147.375,"xyz":[56.906,0.000,-31.262]}},{"noteOn":{"time":147.500,"xyz":[-19.936,0.000,-66.182]}},{"noteOn":{"time":147.625,"xyz":[34.527,0.000,-63.253]}},{"noteOn":{"time":147.750,"xyz":[17.350,0.000,50.118]}},{"noteOn":{"time":147.875,"xyz":[22.643,0.000,-12.361]}},{"noteOn":{"time":148.000,"xyz":[-11.919,0.000,61.089]}},{"noteOn":{"time":148.125,"xyz":[27.536,0.000,19.519]}},{"noteOn":{"time":148.250,"xyz":[16.609,0.000,-54.608]}},{"noteOn":{"time":148.375,"xyz":[-41.815,0.000,1.292]}},{"noteOn":{"time":148.500,"xyz":[51.413,0.000,31.951]}},{"noteOn":{"time":148.625,"xyz":[82.267,0.000,-57.813]}},{"noteOn":{"time":148.750,"xyz":[9.477,0.000,4.335]}},{"noteOn":{"time":148.875,"xyz":[-1.252,0.000,-88.537]}},{"noteOn":{"time":149.000,"xyz":[-76.800,0.000,97.525]}},{"noteOn":{"time":149.125,"xyz":[61.458,0.000,-94.795]}},{"noteOn":{"time":149.250,"xyz":[49.223,0.000,8.935]}},{"noteOn":{"time":149.375,"xyz":[38.012,0.000,7.041]}},{"noteOn":{"time":149.500,"xyz":[-51.459,0.000,95.568]}},{"noteOn":{"time":149.625,"xyz":[38.458,0.000,-60.297]}},{"noteOn":{"time":149.750,"xyz":[-2.716,0.000,79.180]}},{"noteOn":{"time":149.875,"xyz":[-1.966,0.000,-45.731]}},{"noteOn":{"time":150.000,"xyz":[37.534,0.000,-68.672]}},{"noteOn":{"time":150.125,"xyz":[48.393,0.000,53.975]}},{"noteOn":{"time":150.250,"xyz":[-72.442,0.000,60.170]}},{"noteOn":{"time":150.375,"xyz":[-38.321,0.000,-0.519]}},{"noteOn":{"time":150.500,"xyz":[0.828,0.000,-29.094]}},{"noteOn":{"time":150.625,"xyz":[-98.159,0.000,-7.546]}},{"noteOn":{"time":150.750,"xyz":[93.206,0.000,21.721]}},{"noteOn":{"time":150.875,"xyz":[-32.467,0.000,-15.662]}},{"noteOn":{"time":151.000,"xyz":[47.668,0.000,-52.887]}},{"noteOn":{"time":151.125,"xyz":[61.004,0.000,7.208]}},{"noteOn":{"time":151.250,"xyz":[55.944,0.000,70.480]}},{"noteOn":{"time":151.375,"xyz":[67.330,0.000,-26.443]}},{"noteOn":{"time":151.500,"xyz":[46.442,0.000,-22.166]}},{"noteOn":{"time":151.625,"xyz":[-21.620,0.000,41.915]}},{"noteOn":{"time":151.750,"xyz":[-22.157,0.000,74.532]}},{"noteOn":{"time":151.875,"xyz":[45.875,0.000,95.150]}},{"noteOn":{"time":152.000,"xyz":[-52.272,0.000,96.881]}},{"noteOn":{"time":152.125,"xyz":[97.934,0.000,-71.647]}},{"noteOn":{"time":152.250,"xyz":[75.625,0.000,-99.493]}},{"noteOn":{"time":152.375,"xyz":[3.461,0.000,-6.843]}},{"noteOn":{"time":152.500,"xyz":[-30.159,0.000,97.356]}},{"noteOn":{"time":152.625,"xyz":[-81.231,0.000,-4.617]}},{"noteOn":{"time":152.750,"xyz":[37.459,0.000,-36.804]}},{"noteOn":{"time":152.875,"xyz":[0.796,0.000,92.879]}},{"noteOn":{"time":153.000,"xyz":[-53.122,0.000,87.511]}},{"noteOn":{"time":153.125,"xyz":[-78.699,0.000,90.431]}},{"noteOn":{"time":153.250,"xyz":[2.260,0.000,87.651]}},{"noteOn":{"time":153.375,"xyz":[-33.581,0.000,78.615]}},{"noteOn":{"time":153.500,"xyz":[39.270,0.000,-40.893]}},{"noteOn":{"time":153.625,"xyz":[-44.072,0.000,13.475]}},{"noteOn":{"time":153.750,"xyz":[-98.517,0.000,83.804]}},{"noteOn":{"time":153.875,"xyz":[66.630,0.000,-16.107]}},{"noteOn":{"time":154.000,"xyz":[6.823,0.000,-31.730]}},{"noteOn":{"time":154.125,"xyz":[94.202,0.000,-36.470]}},{"noteOn":{"time":154.250,"xyz":[-36.578,0.000,33.568]}},{"noteOn":{"time":154.375,"xyz":[-62.098,0.000,94.209]}},{"noteOn":{"time":154.500,"xyz":[44.267,0.000,28.855]}},{"noteOn":{"time":154.625,"xyz":[-57.498,0.000,-2.372]}},{"noteOn":{"time":154.750,"xyz":[-19.994,0.000,90.454]}},{"noteOn":{"time":154.875,"xyz":[-18.186,0.000,62.257]}},{"noteOn":{"time":155.000,"xyz":[-20.696,0.000,-81.696]}},{"noteOn":{"time":155.125,"xyz":[18.206,0.000,-97.690]}},{"noteOn":{"time":155.250,"xyz":[-63.903,0.000,-8.326]}},{"noteOn":{"time":155.375,"xyz":[-77.539,0.000,35.665]}},{"noteOn":{"time":155.500,"xyz":[33.154,0.000,-3.997]}},{"noteOn":{"time":155.625,"xyz":[-11.637,0.000,77.601]}},{"noteOn":{"time":155.750,"xyz":[1.285,0.000,82.753]}},{"noteOn":{"time":155.875,"xyz":[26.386,0.000,-2.770]}},{"noteOn":{"time":156.000,"xyz":[-56.397,0.000,34.144]}},{"noteOn":{"time":156.125,"xyz":[-29.137,0.000,33.502]}},{"noteOn":{"time":156.250,"xyz":[84.187,0.000,54.640]}},{"noteOn":{"time":156.375,"xyz":[-15.003,0.000,-82.348]}},{"noteOn":{"time":156.500,"xyz":[50.546,0.000,-38.917]}},{"noteOn":{"time":156.625,"xyz":[98.110,0.000,98.971]}},{"noteOn":{"time":156.750,"xyz":[-50.760,0.000,-6.685]}},{"noteOn":{"time":156.875,"xyz":[59.488,0.000,-79.232]}},{"noteOn":{"time":157.000,"xyz":[-55.960,0.000,-82.798]}},{"noteOn":{"time":157.125,"xyz":[-56.803,0.000,-56.593]}},{"noteOn":{"time":157.250,"xyz":[96.005,0.000,-58.101]}},{"noteOn":{"time":157.375,"xyz":[88.263,0.000,61.285]}},{"noteOn":{"time":157.500,"xyz":[74.846,0.000,23.263]}},{"noteOn":{"time":157.625,"xyz":[8.570,0.000,-89.364]}},{"noteOn":{"time":157.750,"xyz":[0.956,0.000,-24.738]}},{"noteOn":{"time":157.875,"xyz":[-43.141,0.000,-84.980]}},{"noteOn":{"time":158.000,"xyz":[-72.523,0.000,61.274]}},{"noteOn":{"time":158.125,"xyz":[77.209,0.000,-34.605]}},{"noteOn":{"time":158.250,"xyz":[-78.219,0.000,-12.863]}},{"noteOn":{"time":158.375,"xyz":[-69.635,0.000,-18.374]}},{"noteOn":{"time":158.500,"xyz":[-44.255,0.000,67.842]}},{"noteOn":{"time":158.625,"xyz":[26.294,0.000,52.315]}},{"noteOn":{"time":158.750,"xyz":[64.180,0.000,-10.276]}},{"noteOn":{"time":158.875,"xyz":[48.344,0.000,99.832]}},{"noteOn":{"time":159.000,"xyz":[80.810,0.000,40.039]}},{"noteOn":{"time":159.125,"xyz":[-96.622,0.000,67.408]}},{"noteOn":{"time":159.250,"xyz":[-88.842,0.000,-74.198]}},{"noteOn":{"time":159.375,"xyz":[-17.742,0.000,75.178]}},{"noteOn":{"time":159.500,"xyz":[-48.276,0.000,-46.246]}},{"noteOn":{"time":159.625,"xyz":[65.061,0.000,42.047]}},{"noteOn":{"time":159.750,"xyz":[-85.174,0.000,-6.662]}},{"noteOn":{"time":159.875,"xyz":[-44.613,0.000,-79.754]}},{"noteOn":{"time":160.000,"xyz":[-31.521,0.000,94.558]}},{"noteOn":{"time":160.125,"xyz":[-21.842,0.000,-60.543]}},{"noteOn":{"time":160.250,"xyz":[-49.307,0.000,82.596]}},{"noteOn":{"time":160.375,"xyz":[-74.748,0.000,-92.606]}},{"noteOn":{"time":160.500,"xyz":[67.553,0.000,-98.938]}},{"noteOn":{"time":160.625,"xyz":[83.376,0.000,63.692]}},{"noteOn":{"time":160.750,"xyz":[-65.531,0.000,-74.251]}},{"noteOn":{"time":160.875,"xyz":[28.535,0.000,33.996]}},{"noteOn":{"time":161.000,"xyz":[69.960,0.000,-79.225]}},{"noteOn":{"time":161.125,"xyz":[-78.520,0.000,81.125]}},{"noteOn":{"time":161.250,"xyz":[1.357,0.000,-41.017]}},{"noteOn":{"time":161.375,"xyz":[88.504,0.000,-99.830]}},{"noteOn":{"time":161.500,"xyz":[-8.208,0.000,78.466]}},{"noteOn":{"time":161.625,"xyz":[-78.030,0.000,54.428]}},{"noteOn":{"time":161.750,"xyz":[47.851,0.000,97.111]}},{"noteOn":{"time":161.875,"xyz":[-15.065,0.000,-0.984]}},{"noteOn":{"time":162.000,"xyz":[-82.731,0.000,57.019]}},{"noteOn":{"time":162.125,"xyz":[54.251,0.000,89.063]}},{"noteOn":{"time":162.250,"xyz":[36.034,0.000,20.681]}},{"noteOn":{"time":162.375,"xyz":[86.528,0.000,19.348]}},{"noteOn":{"time":162.500,"xyz":[34.287,0.000,-9.204]}},{"noteOn":{"time":162.625,"xyz":[-58.696,0.000,-7.743]}},{"noteOn":{"time":162.750,"xyz":[60.376,0.000,-24.415]}},{"noteOn":{"time":162.875,"xyz":[-54.164,0.000,-39.069]}},{"noteOn":{"time":163.000,"xyz":[32.461,0.000,71.497]}},{"noteOn":{"time":163.125,"xyz":[35.856,0.000,-55.506]}},{"noteOn":{"time":163.250,"xyz":[-22.975,0.000,85.168]}},{"noteOn":{"time":163.375,"xyz":[56.684,0.000,62.214]}},{"noteOn":{"time":163.500,"xyz":[63.676,0.000,66.516]}},{"noteOn":{"time":163.625,"xyz":[59.060,0.000,-16.503]}},{"noteOn":{"time":163.750,"xyz":[-4.388,0.000,-25.161]}},{"noteOn":{"time":163.875,"xyz":[74.090,0.000,-59.436]}},{"noteOn":{"time":164.000,"xyz":[65.130,0.000,-50.197]}},{"noteOn":{"time":164.125,"xyz":[-98.344,0.000,-99.289]}},{"noteOn":{"time":164.250,"xyz":[33.542,0.000,-90.820]}},{"noteOn":{"time":164.375,"xyz":[96.687,0.000,-54.999]}},{"noteOn":{"time":164.500,"xyz":[44.885,0.000,45.223]}},{"noteOn":{"time":164.625,"xyz":[-12.349,0.000,-49.711]}},{"noteOn":{"time":164.750,"xyz":[32.794,0.000,41.551]}},{"noteOn":{"time":164.875,"xyz":[11.648,0.000,-78.568]}},{"noteOn":{"time":165.000,"xyz":[-70.090,0.000,82.413]}},{"noteOn":{"time":165.125,"xyz":[-99.513,0.000,-29.423]}},{"noteOn":{"time":165.250,"xyz":[39.213,0.000,-23.792]}},{"noteOn":{"time":165.375,"xyz":[-97.896,0.000,-9.613]}},{"noteOn":{"time":165.500,"xyz":[-23.370,0.000,-34.855]}},{"noteOn":{"time":165.625,"xyz":[71.715,0.000,-81.905]}},{"noteOn":{"time":165.750,"xyz":[44.316,0.000,42.905]}},{"noteOn":{"time":165.875,"xyz":[-82.934,0.000,-62.751]}},{"noteOn":{"time":166.000,"xyz":[-56.027,0.000,52.184]}},{"noteOn":{"time":166.125,"xyz":[-67.836,0.000,14.025]}},{"noteOn":{"time":166.250,"xyz":[-10.420,0.000,84.005]}},{"noteOn":{"time":166.375,"xyz":[3.851,0.000,14.993]}},{"noteOn":{"time":166.500,"xyz":[28.915,0.000,-49.354]}},{"noteOn":{"time":166.625,"xyz":[-74.384,0.000,-96.805]}},{"noteOn":{"time":166.750,"xyz":[-66.759,0.000,-45.908]}},{"noteOn":{"time":166.875,"xyz":[-97.001,0.000,-40.579]}},{"noteOn":{"time":167.000,"xyz":[-35.471,0.000,21.859]}},{"noteOn":{"time":167.125,"xyz":[-15.023,0.000,25.560]}},{"noteOn":{"time":167.250,"xyz":[-20.404,0.000,-67.922]}},{"noteOn":{"time":167.375,"xyz":[5.698,0.000,16.890]}},{"noteOn":{"time":167.500,"xyz":[80.532,0.000,-0.280]}},{"noteOn":{"time":167.625,"xyz":[70.946,0.000,0.191]}},{"noteOn":{"time":167.750,"xyz":[-29.206,0.000,45.814]}},{"noteOn":{"time":167.875,"xyz":[73.704,0.000,-15.447]}},{"noteOn":{"time":168.000,"xyz":[-73.670,0.000,-78.441]}},{"noteOn":{"time":168.125,"xyz":[-26.808,0.000,21.755]}},{"noteOn":{"time":168.250,"xyz":[-58.867,0.000,-90.805]}},{"noteOn":{"time":168.375,"xyz":[21.764,0.000,63.090]}},{"noteOn":{"time":168.500,"xyz":[56.566,0.000,-28.505]}},{"noteOn":{"time":168.625,"xyz":[-25.978,0.000,69.504]}},{"noteOn":{"time":168.750,"xyz":[-66.138,0.000,71.777]}},{"noteOn":{"time":168.875,"xyz":[-37.461,0.000,-78.057]}},{"noteOn":{"time":169.000,"xyz":[-20.835,0.000,36.294]}},{"noteOn":{"time":169.125,"xyz":[-25.446,0.000,-71.245]}},{"noteOn":{"time":169.250,"xyz":[-19.526,0.000,80.879]}},{"noteOn":{"time":169.375,"xyz":[-85.977,0.000,-22.949]}},{"noteOn":{"time":169.500,"xyz":[65.886,0.000,-26.269]}},{"noteOn":{"time":169.625,"xyz":[83.389,0.000,24.877]}},{"noteOn":{"time":169.750,"xyz":[42.500,0.000,56.198]}},{"noteOn":{"time":169.875,"xyz":[-30.534,0.000,81.085]}},{"noteOn":{"time":170.000,"xyz":[25.362,0.000,-6.549]}},{"noteOn":{"time":170.125,"xyz":[67.783,0.000,69.775]}},{"noteOn":{"time":170.250,"xyz":[-84.185,0.000,-23.087]}},{"noteOn":{"time":170.375,"xyz":[-70.203,0.000,26.179]}},{"noteOn":{"time":170.500,"xyz":[-61.347,0.000,-49.677]}},{"noteOn":{"time":170.625,"xyz":[67.318,0.000,-79.128]}},{"noteOn":{"time":170.750,"xyz":[97.425,0.000,81.300]}},{"noteOn":{"time":170.875,"xyz":[-1.455,0.000,59.169]}},{"noteOn":{"time":171.000,"xyz":[57.289,0.000,-49.697]}},{"noteOn":{"time":171.125,"xyz":[-29.925,0.000,52.599]}},{"noteOn":{"time":171.250,"xyz":[14.770,0.000,-21.163]}},{"noteOn":{"time":171.375,"xyz":[-60.738,0.000,9.323]}},{"noteOn":{"time":171.500,"xyz":[-36.183,0.000,68.795]}},{"noteOn":{"time":171.625,"xyz":[51.305,0.000,40.372]}},{"noteOn":{"time":171.750,"xyz":[17.518,0.000,74.815]}},{"noteOn":{"time":171.875,"xyz":[95.441,0.000,28.579]}},{"noteOn":{"time":172.000,"xyz":[94.852,0.000,-18.494]}},{"noteOn":{"time":172.125,"xyz":[74.603,0.000,57.083]}},{"noteOn":{"time":172.250,"xyz":[-68.136,0.000,-92.553]}},{"noteOn":{"time":172.375,"xyz":[72.944,0.000,-55.723]}},{"noteOn":{"time":172.500,"xyz":[26.618,0.000,-92.192]}},{"noteOn":{"time":172.625,"xyz":[55.576,0.000,-17.921]}},{"noteOn":{"time":172.750,"xyz":[-22.676,0.000,-2.519]}},{"noteOn":{"time":172.875,"xyz":[84.918,0.000,24.395]}},{"noteOn":{"time":173.000,"xyz":[-77.002,0.000,66.597]}},{"noteOn":{"time":173.125,"xyz":[88.018,0.000,-77.348]}},{"noteOn":{"time":173.250,"xyz":[46.036,0.000,10.301]}},{"noteOn":{"time":173.375,"xyz":[-40.778,0.000,-44.718]}},{"noteOn":{"time":173.500,"xyz":[-53.919,0.000,44.653]}},{"noteOn":{"time":173.625,"xyz":[32.580,0.000,-51.982]}},{"noteOn":{"time":173.750,"xyz":[-55.448,0.000,30.545]}},{"noteOn":{"time":173.875,"xyz":[8.344,0.000,31.892]}},{"noteOn":{"time":174.000,"xyz":[29.210,0.000,77.498]}},{"noteOn":{"time":174.125,"xyz":[67.945,0.000,35.803]}},{"noteOn":{"time":174.250,"xyz":[-1.860,0.000,-50.789]}},{"noteOn":{"time":174.375,"xyz":[-38.175,0.000,-39.477]}},{"noteOn":{"time":174.500,"xyz":[12.525,0.000,42.755]}},{"noteOn":{"time":174.625,"xyz":[-95.505,0.000,31.031]}},{"noteOn":{"time":174.750,"xyz":[17.576,0.000,-36.737]}},{"noteOn":{"time":174.875,"xyz":[-38.815,0.000,74.042]}},{"noteOn":{"time":175.000,"xyz":[-58.987,0.000,-33.989]}},{"noteOn":{"time":175.125,"xyz":[60.487,0.000,17.602]}},{"noteOn":{"time":175.250,"xyz":[28.445,0.000,-12.252]}},{"noteOn":{"time":175.375,"xyz":[17.336,0.000,-40.370]}},{"noteOn":{"time":175.500,"xyz":[-74.946,0.000,39.171]}},{"noteOn":{"time":175.625,"xyz":[0.724,0.000,-97.718]}},{"noteOn":{"time":175.750,"xyz":[-37.066,0.000,-19.603]}},{"noteOn":{"time":175.875,"xyz":[-69.488,0.000,99.009]}},{"noteOn":{"time":176.000,"xyz":[-36.531,0.000,-48.677]}},{"noteOn":{"time":176.125,"xyz":[-62.276,0.000,11.185]}},{"noteOn":{"time":176.250,"xyz":[-85.868,0.000,-21.259]}},{"noteOn":{"time":176.375,"xyz":[72.687,0.000,-78.819]}},{"noteOn":{"time":176.500,"xyz":[-70.935,0.000,-67.908]}},{"noteOn":{"time":176.625,"xyz":[95.397,0.000,98.757]}},{"noteOn":{"time":176.750,"xyz":[-47.174,0.000,49.717]}},{"noteOn":{"time":176.875,"xyz":[32.496,0.000,67.656]}},{"noteOn":{"time":177.000,"xyz":[-83.319,0.000,-92.497]}},{"noteOn":{"time":177.125,"xyz":[35.213,0.000,-30.740]}},{"noteOn":{"time":177.250,"xyz":[-93.202,0.000,-48.222]}},{"noteOn":{"time":177.375,"xyz":[-77.338,0.000,70.195]}},{"noteOn":{"time":177.500,"xyz":[-46.260,0.000,-31.659]}},{"noteOn":{"time":177.625,"xyz":[44.873,0.000,-89.241]}},{"noteOn":{"time":177.750,"xyz":[-97.380,0.000,-90.498]}},{"noteOn":{"time":177.875,"xyz":[-50.089,0.000,41.038]}},{"noteOn":{"time":178.000,"xyz":[73.290,0.000,-48.996]}},{"noteOn":{"time":178.125,"xyz":[-10.516,0.000,-58.397]}},{"noteOn":{"time":178.250,"xyz":[69.952,0.000,-99.298]}},{"noteOn":{"time":178.375,"xyz":[47.398,0.000,-24.359]}},{"noteOn":{"time":178.500,"xyz":[-50.447,0.000,-69.127]}},{"noteOn":{"time":178.625,"xyz":[25.232,0.000,69.413]}},{"noteOn":{"time":178.750,"xyz":[8.343,0.000,56.037]}},{"noteOn":{"time":178.875,"xyz":[-30.371,0.000,67.908]}},{"noteOn":{"time":179.000,"xyz":[95.975,0.000,28.160]}},{"noteOn":{"time":179.125,"xyz":[-24.451,0.000,-37.438]}},{"noteOn":{"time":179.250,"xyz":[16.519,0.000,-28.883]}},{"noteOn":{"time":179.375,"xyz":[49.882,0.000,37.929]}},{"noteOn":{"time":179.500,"xyz":[25.766,0.000,-73.722]}},{"noteOn":{"time":179.625,"xyz":[-30.213,0.000,34.164]}},{"noteOn":{"time":179.750,"xyz":[84.190,0.000,-68.884]}},{"noteOn":{"time":179.875,"xyz":[20.128,0.000,72.212]}},{"noteOn":{"time":180.000,"xyz":[-25.045,0.000,-97.311]}},{"noteOn":{"time":180.125,"xyz":[-55.608,0.000,-61.445]}},{"noteOn":{"time":180.250,"xyz":[46.338,0.000,47.881]}},{"noteOn":{"time":180.375,"xyz":[93.454,0.000,-23.583]}},{"noteOn":{"time":180.500,"xyz":[-12.069,0.000,-27.724]}},{"noteOn":{"time":180.625,"xyz":[6.573,0.000,80.279]}},{"noteOn":{"time":180.750,"xyz":[-99.981,0.000,-90.459]}},{"noteOn":{"time":180.875,"xyz":[-91.015,0.000,-59.407]}},{"noteOn":{"time":181.000,"xyz":[-34.510,0.000,-56.808]}},{"noteOn":{"time":181.125,"xyz":[60.475,0.000,-64.430]}},{"noteOn":{"time":181.250,"xyz":[83.659,0.000,-57.385]}},{"noteOn":{"time":181.375,"xyz":[-60.696,0.000,-83.091]}},{"noteOn":{"time":181.500,"xyz":[75.386,0.000,-14.777]}},{"noteOn":{"time":181.625,"xyz":[95.853,0.000,-13.658]}},{"noteOn":{"time":181.750,"xyz":[-81.149,0.000,86.622]}},{"noteOn":{"time":181.875,"xyz":[-39.622,0.000,9.889]}},{"noteOn":{"time":182.000,"xyz":[-74.625,0.000,-89.349]}},{"noteOn":{"time":182.125,"xyz":[-60.761,0.000,66.666]}},{"noteOn":{"time":182.250,"xyz":[14.650,0.000,-18.808]}},{"noteOn":{"time":182.375,"xyz":[-16.025,0.000,79.150]}},{"noteOn":{"time":182.500,"xyz":[98.762,0.000,-32.394]}},{"noteOn":{"time":182.625,"xyz":[67.617,0.000,-78.240]}},{"noteOn":{"time":182.750,"xyz":[34.373,0.000,65.675]}},{"noteOn":{"time":182.875,"xyz":[52.589,0.000,-45.367]}},{"noteOn":{"time":183.000,"xyz":[52.448,0.000,-54.068]}},{"noteOn":{"time":183.125,"xyz":[84.597,0.000,-20.529]}},{"noteOn":{"time":183.250,"xyz":[24.892,0.000,-8.752]}},{"noteOn":{"time":183.375,"xyz":[96.861,0.000,64.336]}},{"noteOn":{"time":183.500,"xyz":[-22.523,0.000,-4.456]}},{"noteOn":{"time":183.625,"xyz":[59.081,0.000,-65.740]}},{"noteOn":{"time":183.750,"xyz":[-91.566,0.000,-54.474]}},{"noteOn":{"time":183.875,"xyz":[55.500,0.000,74.553]}},{"noteOn":{"time":184.000,"xyz":[22.084,0.000,-42.714]}},{"noteOn":{"time":184.125,"xyz":[-73.558,0.000,-56.315]}},{"noteOn":{"time":184.250,"xyz":[-63.122,0.000,89.672]}},{"noteOn":{"time":184.375,"xyz":[57.707,0.000,-57.395]}},{"noteOn":{"time":184.500,"xyz":[77.238,0.000,6.291]}},{"noteOn":{"time":184.625,"xyz":[-47.812,0.000,37.388]}},{"noteOn":{"time":184.750,"xyz":[-91.451,0.000,-91.993]}},{"noteOn":{"time":184.875,"xyz":[68.094,0.000,-17.927]}},{"noteOn":{"time":185.000,"xyz":[-75.304,0.000,7.842]}},{"noteOn":{"time":185.125,"xyz":[58.142,0.000,-61.424]}},{"noteOn":{"time":185.250,"xyz":[-52.482,0.000,70.116]}},{"noteOn":{"time":185.375,"xyz":[-5.891,0.000,-59.461]}},{"noteOn":{"time":185.500,"xyz":[-52.458,0.000,-14.269]}},{"noteOn":{"time":185.625,"xyz":[11.107,0.000,98.010]}},{"noteOn":{"time":185.750,"xyz":[45.395,0.000,5.460]}},{"noteOn":{"time":185.875,"xyz":[55.957,0.000,89.813]}},{"noteOn":{"time":186.000,"xyz":[3.240,0.000,-96.884]}},{"noteOn":{"time":186.125,"xyz":[74.043,0.000,-59.515]}},{"noteOn":{"time":186.250,"xyz":[-34.367,0.000,-9.515]}},{"noteOn":{"time":186.375,"xyz":[19.018,0.000,-71.331]}},{"noteOn":{"time":186.500,"xyz":[59.175,0.000,-44.116]}},{"noteOn":{"time":186.625,"xyz":[-80.266,0.000,-76.184]}},{"noteOn":{"time":186.750,"xyz":[-89.685,0.000,-51.767]}},{"noteOn":{"time":186.875,"xyz":[88.775,0.000,98.085]}},{"noteOn":{"time":187.000,"xyz":[-9.294,0.000,-21.494]}},{"noteOn":{"time":187.125,"xyz":[6.966,0.000,10.322]}},{"noteOn":{"time":187.250,"xyz":[-50.539,0.000,-39.555]}},{"noteOn":{"time":187.375,"xyz":[68.233,0.000,-91.030]}},{"noteOn":{"time":187.500,"xyz":[-58.290,0.000,-37.599]}},{"noteOn":{"time":187.625,"xyz":[19.192,0.000,-49.189]}},{"noteOn":{"time":187.750,"xyz":[12.816,0.000,92.181]}},{"noteOn":{"time":187.875,"xyz":[-22.162,0.000,82.401]}},{"noteOn":{"time":188.000,"xyz":[47.627,0.000,86.791]}},{"noteOn":{"time":188.125,"xyz":[-34.291,0.000,-18.934]}},{"noteOn":{"time":188.250,"xyz":[44.152,0.000,-71.081]}},{"noteOn":{"time":188.375,"xyz":[-62.095,0.000,-97.641]}},{"noteOn":{"time":188.500,"xyz":[-78.988,0.000,62.065]}},{"noteOn":{"time":188.625,"xyz":[-54.671,0.000,-69.175]}},{"noteOn":{"time":188.750,"xyz":[-81.934,0.000,26.170]}},{"noteOn":{"time":188.875,"xyz":[-86.465,0.000,-19.036]}},{"noteOn":{"time":189.000,"xyz":[99.574,0.000,-14.366]}},{"noteOn":{"time":189.125,"xyz":[-27.452,0.000,-54.731]}},{"noteOn":{"time":189.250,"xyz":[-80.728,0.000,71.587]}},{"noteOn":{"time":189.375,"xyz":[-77.961,0.000,36.204]}},{"noteOn":{"time":189.500,"xyz":[56.733,0.000,-89.706]}},{"noteOn":{"time":189.625,"xyz":[66.221,0.000,19.005]}},{"noteOn":{"time":189.750,"xyz":[-15.599,0.000,-40.429]}},{"noteOn":{"time":189.875,"xyz":[-97.142,0.000,82.176]}},{"noteOn":{"time":190.000,"xyz":[-25.344,0.000,-74.919]}},{"noteOn":{"time":190.125,"xyz":[0.733,0.000,-57.448]}},{"noteOn":{"time":190.250,"xyz":[-93.702,0.000,-21.613]}},{"noteOn":{"time":190.375,"xyz":[49.988,0.000,31.815]}},{"noteOn":{"time":190.500,"xyz":[79.815,0.000,-51.363]}},{"noteOn":{"time":190.625,"xyz":[-80.329,0.000,61.321]}},{"noteOn":{"time":190.750,"xyz":[-99.181,0.000,-90.236]}},{"noteOn":{"time":190.875,"xyz":[6.899,0.000,-87.869]}}],"02c103e8fcef483292ebc49d3898ef96":[{"instanceName":""},{"noteOn":{"time":7.000,"xyz":[85.142,0.000,-77.018]}},{"noteOn":{"time":7.058,"xyz":[-98.899,0.000,0.763]}},{"noteOn":{"time":7.125,"xyz":[79.449,0.000,12.289]}},{"noteOn":{"time":7.183,"xyz":[40.222,0.000,-8.918]}},{"noteOn":{"time":7.250,"xyz":[51.690,0.000,51.698]}},{"noteOn":{"time":7.308,"xyz":[-46.879,0.000,-39.526]}},{"noteOn":{"time":7.375,"xyz":[85.474,0.000,-19.716]}},{"noteOn":{"time":7.433,"xyz":[21.588,0.000,60.273]}},{"noteOn":{"time":7.500,"xyz":[74.731,0.000,-76.198]}},{"noteOn":{"time":7.558,"xyz":[64.492,0.000,-10.794]}},{"noteOn":{"time":7.625,"xyz":[83.750,0.000,46.966]}},{"noteOn":{"time":7.683,"xyz":[-16.314,0.000,47.499]}},{"noteOn":{"time":7.750,"xyz":[-49.256,0.000,78.324]}},{"noteOn":{"time":7.808,"xyz":[-17.272,0.000,-99.381]}},{"noteOn":{"time":7.875,"xyz":[53.147,0.000,28.023]}},{"noteOn":{"time":7.933,"xyz":[-27.426,0.000,85.243]}},{"noteOn":{"time":8.000,"xyz":[79.660,0.000,38.476]}},{"noteOn":{"time":8.058,"xyz":[-80.803,0.000,67.588]}},{"noteOn":{"time":8.125,"xyz":[60.475,0.000,88.602]}},{"noteOn":{"time":8.183,"xyz":[-53.918,0.000,90.199]}},{"noteOn":{"time":8.250,"xyz":[5.760,0.000,-23.564]}},{"noteOn":{"time":8.308,"xyz":[92.277,0.000,-19.755]}},{"noteOn":{"time":8.375,"xyz":[5.784,0.000,94.908]}},{"noteOn":{"time":8.433,"xyz":[-43.481,0.000,-97.341]}},{"noteOn":{"time":8.500,"xyz":[-33.402,0.000,-45.893]}},{"noteOn":{"time":8.558,"xyz":[-57.426,0.000,-12.183]}},{"noteOn":{"time":8.625,"xyz":[5.361,0.000,52.721]}},{"noteOn":{"time":8.683,"xyz":[72.630,0.000,8.132]}},{"noteOn":{"time":8.750,"xyz":[-78.210,0.000,-75.769]}},{"noteOn":{"time":8.808,"xyz":[67.092,0.000,83.616]}},{"noteOn":{"time":8.875,"xyz":[9.293,0.000,42.197]}},{"noteOn":{"time":8.933,"xyz":[12.692,0.000,-74.431]}},{"noteOn":{"time":9.000,"xyz":[-16.426,0.000,-73.779]}},{"noteOn":{"time":9.058,"xyz":[-30.780,0.000,42.585]}},{"noteOn":{"time":9.125,"xyz":[-99.517,0.000,-91.671]}},{"noteOn":{"time":9.183,"xyz":[-89.386,0.000,-3.445]}},{"noteOn":{"time":9.250,"xyz":[20.990,0.000,-38.896]}},{"noteOn":{"time":9.308,"xyz":[-28.585,0.000,70.740]}},{"noteOn":{"time":9.375,"xyz":[-28.023,0.000,16.463]}},{"noteOn":{"time":9.433,"xyz":[86.919,0.000,-40.141]}},{"noteOn":{"time":9.500,"xyz":[59.584,0.000,79.935]}},{"noteOn":{"time":9.558,"xyz":[87.456,0.000,-24.085]}},{"noteOn":{"time":9.625,"xyz":[-70.506,0.000,32.206]}},{"noteOn":{"time":9.683,"xyz":[-53.511,0.000,-54.290]}},{"noteOn":{"time":9.750,"xyz":[-51.524,0.000,70.064]}},{"noteOn":{"time":9.808,"xyz":[-98.858,0.000,-80.834]}},{"noteOn":{"time":9.875,"xyz":[16.020,0.000,-64.857]}},{"noteOn":{"time":9.933,"xyz":[-25.062,0.000,-25.829]}},{"noteOn":{"time":10.000,"xyz":[16.704,0.000,-26.371]}},{"noteOn":{"time":10.058,"xyz":[-51.689,0.000,56.208]}},{"noteOn":{"time":10.125,"xyz":[-94.646,0.000,-74.295]}},{"noteOn":{"time":10.183,"xyz":[55.493,0.000,91.994]}},{"noteOn":{"time":10.250,"xyz":[90.687,0.000,-77.344]}},{"noteOn":{"time":10.308,"xyz":[-50.945,0.000,28.281]}},{"noteOn":{"time":10.375,"xyz":[61.468,0.000,-65.419]}},{"noteOn":{"time":10.433,"xyz":[-21.737,0.000,-67.677]}},{"noteOn":{"time":10.500,"xyz":[94.700,0.000,25.122]}},{"noteOn":{"time":10.558,"xyz":[87.004,0.000,-88.212]}},{"noteOn":{"time":10.625,"xyz":[-89.433,0.000,94.048]}},{"noteOn":{"time":10.683,"xyz":[63.756,0.000,-68.371]}},{"noteOn":{"time":10.750,"xyz":[-93.761,0.000,86.387]}},{"noteOn":{"time":10.808,"xyz":[-17.443,0.000,86.109]}},{"noteOn":{"time":10.875,"xyz":[22.715,0.000,-19.422]}},{"noteOn":{"time":10.933,"xyz":[72.540,0.000,88.236]}},{"noteOn":{"time":11.000,"xyz":[-11.868,0.000,0.339]}},{"noteOn":{"time":11.058,"xyz":[56.931,0.000,-71.050]}},{"noteOn":{"time":11.125,"xyz":[-50.086,0.000,88.125]}},{"noteOn":{"time":11.183,"xyz":[22.905,0.000,-3.162]}},{"noteOn":{"time":11.250,"xyz":[-30.710,0.000,94.645]}},{"noteOn":{"time":11.308,"xyz":[33.908,0.000,98.605]}},{"noteOn":{"time":11.375,"xyz":[17.490,0.000,41.436]}},{"noteOn":{"time":11.433,"xyz":[-11.591,0.000,-56.649]}},{"noteOn":{"time":11.500,"xyz":[-4.033,0.000,-35.517]}},{"noteOn":{"time":11.558,"xyz":[-23.851,0.000,12.508]}},{"noteOn":{"time":11.625,"xyz":[15.689,0.000,-91.212]}},{"noteOn":{"time":11.683,"xyz":[-2.819,0.000,94.511]}},{"noteOn":{"time":11.750,"xyz":[-74.603,0.000,-20.880]}},{"noteOn":{"time":11.808,"xyz":[-97.042,0.000,-18.547]}},{"noteOn":{"time":11.875,"xyz":[-11.665,0.000,23.506]}},{"noteOn":{"time":11.933,"xyz":[4.861,0.000,66.554]}},{"noteOn":{"time":12.000,"xyz":[83.692,0.000,95.713]}},{"noteOn":{"time":12.058,"xyz":[86.361,0.000,-91.158]}},{"noteOn":{"time":12.125,"xyz":[-34.566,0.000,-26.350]}},{"noteOn":{"time":12.183,"xyz":[-36.958,0.000,7.385]}},{"noteOn":{"time":12.250,"xyz":[-40.126,0.000,64.727]}},{"noteOn":{"time":12.308,"xyz":[-27.617,0.000,-85.638]}},{"noteOn":{"time":12.375,"xyz":[-63.402,0.000,69.237]}},{"noteOn":{"time":12.433,"xyz":[55.098,0.000,-23.405]}},{"noteOn":{"time":12.500,"xyz":[57.914,0.000,-38.691]}},{"noteOn":{"time":12.558,"xyz":[-75.603,0.000,91.441]}},{"noteOn":{"time":12.625,"xyz":[12.169,0.000,46.381]}},{"noteOn":{"time":12.683,"xyz":[21.274,0.000,57.706]}},{"noteOn":{"time":12.750,"xyz":[-21.347,0.000,27.029]}},{"noteOn":{"time":12.808,"xyz":[35.415,0.000,57.867]}},{"noteOn":{"time":12.875,"xyz":[-31.092,0.000,17.720]}},{"noteOn":{"time":12.933,"xyz":[-55.105,0.000,87.013]}},{"noteOn":{"time":13.000,"xyz":[53.479,0.000,56.345]}},{"noteOn":{"time":13.058,"xyz":[-93.798,0.000,8.955]}},{"noteOn":{"time":13.125,"xyz":[27.131,0.000,-71.494]}},{"noteOn":{"time":13.183,"xyz":[-78.397,0.000,-66.590]}},{"noteOn":{"time":13.250,"xyz":[-98.357,0.000,12.159]}},{"noteOn":{"time":13.308,"xyz":[-63.917,0.000,32.619]}},{"noteOn":{"time":13.375,"xyz":[-43.834,0.000,27.736]}},{"noteOn":{"time":13.433,"xyz":[83.455,0.000,-86.443]}},{"noteOn":{"time":13.500,"xyz":[-66.924,0.000,4.865]}},{"noteOn":{"time":13.558,"xyz":[-76.680,0.000,95.738]}},{"noteOn":{"time":13.625,"xyz":[55.007,0.000,-86.302]}},{"noteOn":{"time":13.683,"xyz":[99.800,0.000,-23.212]}},{"noteOn":{"time":13.750,"xyz":[68.591,0.000,19.237]}},{"noteOn":{"time":13.808,"xyz":[21.941,0.000,-38.814]}},{"noteOn":{"time":13.875,"xyz":[5.029,0.000,-36.697]}},{"noteOn":{"time":13.933,"xyz":[-73.229,0.000,-55.894]}},{"noteOn":{"time":14.000,"xyz":[-0.653,0.000,23.551]}},{"noteOn":{"time":14.058,"xyz":[-48.124,0.000,-55.102]}},{"noteOn":{"time":14.125,"xyz":[41.667,0.000,4.581]}},{"noteOn":{"time":14.183,"xyz":[27.296,0.000,-64.336]}},{"noteOn":{"time":14.250,"xyz":[-42.562,0.000,-54.700]}},{"noteOn":{"time":14.308,"xyz":[9.306,0.000,72.352]}},{"noteOn":{"time":14.375,"xyz":[-58.109,0.000,-58.278]}},{"noteOn":{"time":14.433,"xyz":[-66.514,0.000,-28.907]}},{"noteOn":{"time":14.500,"xyz":[19.497,0.000,47.896]}},{"noteOn":{"time":14.558,"xyz":[74.064,0.000,43.841]}},{"noteOn":{"time":14.625,"xyz":[-25.600,0.000,92.022]}},{"noteOn":{"time":14.683,"xyz":[73.285,0.000,-22.939]}},{"noteOn":{"time":14.750,"xyz":[15.180,0.000,92.715]}},{"noteOn":{"time":14.808,"xyz":[60.994,0.000,67.909]}},{"noteOn":{"time":14.875,"xyz":[9.369,0.000,44.126]}},{"noteOn":{"time":14.933,"xyz":[33.250,0.000,86.426]}},{"noteOn":{"time":15.000,"xyz":[-37.595,0.000,-79.125]}},{"noteOn":{"time":15.058,"xyz":[72.321,0.000,-61.909]}},{"noteOn":{"time":15.125,"xyz":[96.929,0.000,79.338]}},{"noteOn":{"time":15.183,"xyz":[-36.624,0.000,-49.573]}},{"noteOn":{"time":15.250,"xyz":[-60.890,0.000,76.548]}},{"noteOn":{"time":15.308,"xyz":[51.956,0.000,-10.336]}},{"noteOn":{"time":15.375,"xyz":[-11.477,0.000,7.581]}},{"noteOn":{"time":15.433,"xyz":[-61.091,0.000,35.035]}},{"noteOn":{"time":15.500,"xyz":[44.121,0.000,74.843]}},{"noteOn":{"time":15.558,"xyz":[-37.018,0.000,1.158]}},{"noteOn":{"time":15.625,"xyz":[74.550,0.000,46.510]}},{"noteOn":{"time":15.683,"xyz":[-8.948,0.000,-8.070]}},{"noteOn":{"time":15.750,"xyz":[-30.213,0.000,-5.021]}},{"noteOn":{"time":15.808,"xyz":[22.697,0.000,27.073]}},{"noteOn":{"time":15.875,"xyz":[-34.651,0.000,-16.776]}},{"noteOn":{"time":15.933,"xyz":[54.167,0.000,81.060]}},{"noteOn":{"time":16.000,"xyz":[91.590,0.000,16.514]}},{"noteOn":{"time":16.058,"xyz":[-75.590,0.000,41.534]}},{"noteOn":{"time":16.125,"xyz":[81.267,0.000,-65.048]}},{"noteOn":{"time":16.183,"xyz":[-8.251,0.000,16.384]}},{"noteOn":{"time":16.250,"xyz":[-27.349,0.000,-90.003]}},{"noteOn":{"time":16.308,"xyz":[-73.263,0.000,-92.092]}},{"noteOn":{"time":16.375,"xyz":[35.507,0.000,38.011]}},{"noteOn":{"time":16.433,"xyz":[17.064,0.000,41.456]}},{"noteOn":{"time":16.500,"xyz":[-14.262,0.000,-91.558]}},{"noteOn":{"time":16.558,"xyz":[26.679,0.000,97.049]}},{"noteOn":{"time":16.625,"xyz":[3.894,0.000,-23.985]}},{"noteOn":{"time":16.683,"xyz":[-3.983,0.000,-41.688]}},{"noteOn":{"time":16.750,"xyz":[-4.373,0.000,-2.255]}},{"noteOn":{"time":16.808,"xyz":[75.878,0.000,-23.940]}},{"noteOn":{"time":16.875,"xyz":[90.922,0.000,-80.781]}},{"noteOn":{"time":16.933,"xyz":[-83.374,0.000,56.564]}},{"noteOn":{"time":17.000,"xyz":[-63.809,0.000,-77.079]}},{"noteOn":{"time":17.058,"xyz":[-50.606,0.000,-60.570]}},{"noteOn":{"time":17.125,"xyz":[-48.525,0.000,96.868]}},{"noteOn":{"time":17.183,"xyz":[59.465,0.000,-60.444]}},{"noteOn":{"time":17.250,"xyz":[-33.414,0.000,57.037]}},{"noteOn":{"time":17.308,"xyz":[-73.584,0.000,-95.566]}},{"noteOn":{"time":17.375,"xyz":[-22.419,0.000,74.432]}},{"noteOn":{"time":17.433,"xyz":[53.465,0.000,94.472]}},{"noteOn":{"time":17.500,"xyz":[-59.081,0.000,-70.283]}},{"noteOn":{"time":17.558,"xyz":[92.243,0.000,-57.336]}},{"noteOn":{"time":17.625,"xyz":[9.580,0.000,57.599]}},{"noteOn":{"time":17.683,"xyz":[51.438,0.000,-96.742]}},{"noteOn":{"time":17.750,"xyz":[-24.237,0.000,62.088]}},{"noteOn":{"time":17.808,"xyz":[20.941,0.000,69.564]}},{"noteOn":{"time":17.875,"xyz":[-18.916,0.000,-5.104]}},{"noteOn":{"time":17.933,"xyz":[-90.300,0.000,41.248]}},{"noteOn":{"time":18.000,"xyz":[-50.096,0.000,5.052]}},{"noteOn":{"time":18.058,"xyz":[48.039,0.000,63.855]}},{"noteOn":{"time":18.125,"xyz":[-42.900,0.000,-99.173]}},{"noteOn":{"time":18.183,"xyz":[-93.818,0.000,60.347]}},{"noteOn":{"time":18.250,"xyz":[20.682,0.000,-72.250]}},{"noteOn":{"time":18.308,"xyz":[92.629,0.000,38.714]}},{"noteOn":{"time":18.375,"xyz":[74.690,0.000,71.382]}},{"noteOn":{"time":18.433,"xyz":[-18.624,0.000,3.675]}},{"noteOn":{"time":18.500,"xyz":[91.315,0.000,-46.907]}},{"noteOn":{"time":18.558,"xyz":[38.270,0.000,-63.416]}},{"noteOn":{"time":18.625,"xyz":[-54.452,0.000,-86.185]}},{"noteOn":{"time":18.683,"xyz":[-63.478,0.000,-51.481]}},{"noteOn":{"time":18.750,"xyz":[13.573,0.000,87.247]}},{"noteOn":{"time":18.808,"xyz":[-67.958,0.000,-30.504]}},{"noteOn":{"time":18.875,"xyz":[-70.137,0.000,-37.454]}},{"noteOn":{"time":18.933,"xyz":[73.389,0.000,24.487]}},{"noteOn":{"time":19.000,"xyz":[-39.822,0.000,39.930]}},{"noteOn":{"time":19.058,"xyz":[-88.852,0.000,76.769]}},{"noteOn":{"time":19.125,"xyz":[-59.149,0.000,-96.925]}},{"noteOn":{"time":19.183,"xyz":[10.033,0.000,-96.272]}},{"noteOn":{"time":19.250,"xyz":[51.303,0.000,82.409]}},{"noteOn":{"time":19.308,"xyz":[16.425,0.000,-78.026]}},{"noteOn":{"time":19.375,"xyz":[89.319,0.000,75.783]}},{"noteOn":{"time":19.433,"xyz":[56.908,0.000,10.102]}},{"noteOn":{"time":19.500,"xyz":[-30.449,0.000,-59.934]}},{"noteOn":{"time":19.558,"xyz":[-97.851,0.000,1.024]}},{"noteOn":{"time":19.625,"xyz":[-72.349,0.000,-18.521]}},{"noteOn":{"time":19.683,"xyz":[-12.294,0.000,-55.836]}},{"noteOn":{"time":19.750,"xyz":[-52.213,0.000,-33.593]}},{"noteOn":{"time":19.808,"xyz":[-98.500,0.000,83.276]}},{"noteOn":{"time":19.875,"xyz":[-97.425,0.000,-39.407]}},{"noteOn":{"time":19.933,"xyz":[89.294,0.000,70.854]}},{"noteOn":{"time":20.000,"xyz":[-35.809,0.000,95.398]}},{"noteOn":{"time":20.058,"xyz":[-42.934,0.000,57.516]}},{"noteOn":{"time":20.125,"xyz":[76.100,0.000,67.867]}},{"noteOn":{"time":20.183,"xyz":[25.129,0.000,66.743]}},{"noteOn":{"time":20.250,"xyz":[28.918,0.000,-81.014]}},{"noteOn":{"time":20.308,"xyz":[-24.234,0.000,-95.300]}},{"noteOn":{"time":20.375,"xyz":[23.992,0.000,14.436]}},{"noteOn":{"time":20.433,"xyz":[96.525,0.000,73.734]}},{"noteOn":{"time":20.500,"xyz":[96.731,0.000,86.702]}},{"noteOn":{"time":20.558,"xyz":[17.555,0.000,-30.672]}},{"noteOn":{"time":20.625,"xyz":[71.158,0.000,99.160]}},{"noteOn":{"time":20.683,"xyz":[-63.850,0.000,-43.915]}},{"noteOn":{"time":20.750,"xyz":[-10.014,0.000,74.200]}},{"noteOn":{"time":20.808,"xyz":[-22.704,0.000,-48.671]}},{"noteOn":{"time":20.875,"xyz":[73.326,0.000,-98.906]}},{"noteOn":{"time":20.933,"xyz":[-81.883,0.000,7.617]}},{"noteOn":{"time":21.000,"xyz":[-33.653,0.000,17.620]}},{"noteOn":{"time":21.058,"xyz":[69.178,0.000,90.319]}},{"noteOn":{"time":21.125,"xyz":[4.386,0.000,-45.035]}},{"noteOn":{"time":21.183,"xyz":[19.057,0.000,-93.996]}},{"noteOn":{"time":21.250,"xyz":[15.598,0.000,-39.353]}},{"noteOn":{"time":21.308,"xyz":[73.031,0.000,64.134]}},{"noteOn":{"time":21.375,"xyz":[58.772,0.000,81.529]}},{"noteOn":{"time":21.433,"xyz":[-85.456,0.000,-39.000]}},{"noteOn":{"time":21.500,"xyz":[19.934,0.000,-88.861]}},{"noteOn":{"time":21.558,"xyz":[-48.047,0.000,-26.522]}},{"noteOn":{"time":21.625,"xyz":[28.250,0.000,94.688]}},{"noteOn":{"time":21.683,"xyz":[-54.757,0.000,-46.509]}},{"noteOn":{"time":21.750,"xyz":[-37.897,0.000,-45.799]}},{"noteOn":{"time":21.808,"xyz":[-99.421,0.000,34.590]}},{"noteOn":{"time":21.875,"xyz":[-37.489,0.000,57.242]}},{"noteOn":{"time":21.933,"xyz":[37.163,0.000,-87.762]}},{"noteOn":{"time":22.000,"xyz":[15.775,0.000,-81.420]}},{"noteOn":{"time":22.058,"xyz":[-66.597,0.000,51.788]}},{"noteOn":{"time":22.125,"xyz":[-27.089,0.000,-92.859]}},{"noteOn":{"time":22.183,"xyz":[-89.618,0.000,25.196]}},{"noteOn":{"time":22.250,"xyz":[2.513,0.000,-56.748]}},{"noteOn":{"time":22.308,"xyz":[-27.489,0.000,-8.222]}},{"noteOn":{"time":22.375,"xyz":[88.760,0.000,-73.869]}},{"noteOn":{"time":22.433,"xyz":[-39.368,0.000,-67.727]}},{"noteOn":{"time":22.500,"xyz":[-50.284,0.000,-58.918]}},{"noteOn":{"time":22.558,"xyz":[44.098,0.000,31.585]}},{"noteOn":{"time":22.625,"xyz":[-74.476,0.000,-27.350]}},{"noteOn":{"time":22.683,"xyz":[48.099,0.000,96.414]}},{"noteOn":{"time":22.750,"xyz":[-66.077,0.000,6.433]}},{"noteOn":{"time":22.808,"xyz":[43.159,0.000,-97.999]}},{"noteOn":{"time":22.875,"xyz":[-25.686,0.000,50.857]}},{"noteOn":{"time":22.933,"xyz":[77.836,0.000,-0.125]}},{"noteOn":{"time":23.000,"xyz":[43.833,0.000,63.584]}},{"noteOn":{"time":23.058,"xyz":[-24.295,0.000,-1.586]}},{"noteOn":{"time":23.125,"xyz":[-27.962,0.000,37.671]}},{"noteOn":{"time":23.183,"xyz":[-93.856,0.000,-37.429]}},{"noteOn":{"time":23.250,"xyz":[-52.565,0.000,-97.142]}},{"noteOn":{"time":23.308,"xyz":[37.911,0.000,-19.110]}},{"noteOn":{"time":23.375,"xyz":[61.597,0.000,39.695]}},{"noteOn":{"time":23.433,"xyz":[-42.693,0.000,29.371]}},{"noteOn":{"time":23.500,"xyz":[-2.391,0.000,1.310]}},{"noteOn":{"time":23.558,"xyz":[-58.466,0.000,35.393]}},{"noteOn":{"time":23.625,"xyz":[-98.510,0.000,-98.109]}},{"noteOn":{"time":23.683,"xyz":[-14.940,0.000,23.206]}},{"noteOn":{"time":23.750,"xyz":[60.581,0.000,-25.140]}},{"noteOn":{"time":23.808,"xyz":[-54.990,0.000,18.013]}},{"noteOn":{"time":23.875,"xyz":[-65.792,0.000,39.897]}},{"noteOn":{"time":23.933,"xyz":[63.145,0.000,-89.118]}},{"noteOn":{"time":24.000,"xyz":[-98.396,0.000,-41.245]}},{"noteOn":{"time":24.058,"xyz":[99.583,0.000,-45.930]}},{"noteOn":{"time":24.125,"xyz":[72.799,0.000,17.843]}},{"noteOn":{"time":24.183,"xyz":[-60.641,0.000,78.455]}},{"noteOn":{"time":24.250,"xyz":[12.241,0.000,63.218]}},{"noteOn":{"time":24.308,"xyz":[69.850,0.000,13.987]}},{"noteOn":{"time":24.375,"xyz":[-85.035,0.000,-56.446]}},{"noteOn":{"time":24.433,"xyz":[-62.559,0.000,-36.943]}},{"noteOn":{"time":24.500,"xyz":[13.624,0.000,-98.831]}},{"noteOn":{"time":24.558,"xyz":[-61.909,0.000,-62.218]}},{"noteOn":{"time":24.625,"xyz":[44.071,0.000,3.012]}},{"noteOn":{"time":24.683,"xyz":[41.193,0.000,-61.962]}},{"noteOn":{"time":24.750,"xyz":[20.066,0.000,34.896]}},{"noteOn":{"time":24.808,"xyz":[51.772,0.000,-69.917]}},{"noteOn":{"time":24.875,"xyz":[26.455,0.000,-94.050]}},{"noteOn":{"time":24.933,"xyz":[45.198,0.000,-1.693]}},{"noteOn":{"time":25.000,"xyz":[-2.602,0.000,38.540]}},{"noteOn":{"time":25.058,"xyz":[23.578,0.000,97.514]}},{"noteOn":{"time":25.125,"xyz":[-35.612,0.000,64.449]}},{"noteOn":{"time":25.183,"xyz":[-93.478,0.000,42.741]}},{"noteOn":{"time":25.250,"xyz":[0.404,0.000,-76.722]}},{"noteOn":{"time":25.308,"xyz":[43.363,0.000,-49.658]}},{"noteOn":{"time":25.375,"xyz":[-85.919,0.000,-23.574]}},{"noteOn":{"time":25.433,"xyz":[81.755,0.000,0.540]}},{"noteOn":{"time":25.500,"xyz":[23.745,0.000,-77.922]}},{"noteOn":{"time":25.558,"xyz":[-88.607,0.000,-59.739]}},{"noteOn":{"time":25.625,"xyz":[-71.893,0.000,-64.126]}},{"noteOn":{"time":25.683,"xyz":[83.792,0.000,98.402]}},{"noteOn":{"time":25.750,"xyz":[50.717,0.000,80.898]}},{"noteOn":{"time":25.808,"xyz":[52.248,0.000,56.178]}},{"noteOn":{"time":25.875,"xyz":[-68.394,0.000,41.737]}},{"noteOn":{"time":25.933,"xyz":[-57.295,0.000,15.394]}},{"noteOn":{"time":26.000,"xyz":[-65.749,0.000,-46.797]}},{"noteOn":{"time":26.058,"xyz":[18.766,0.000,-50.115]}},{"noteOn":{"time":26.125,"xyz":[91.660,0.000,-72.708]}},{"noteOn":{"time":26.183,"xyz":[-94.898,0.000,-77.606]}},{"noteOn":{"time":26.250,"xyz":[-5.496,0.000,-55.320]}},{"noteOn":{"time":26.308,"xyz":[45.396,0.000,-86.511]}},{"noteOn":{"time":26.375,"xyz":[-10.796,0.000,81.913]}},{"noteOn":{"time":26.433,"xyz":[-43.677,0.000,52.974]}},{"noteOn":{"time":26.500,"xyz":[67.435,0.000,-94.975]}},{"noteOn":{"time":26.558,"xyz":[60.349,0.000,80.474]}},{"noteOn":{"time":26.625,"xyz":[-47.151,0.000,87.096]}},{"noteOn":{"time":26.683,"xyz":[-0.122,0.000,-97.389]}},{"noteOn":{"time":26.750,"xyz":[-11.276,0.000,13.668]}},{"noteOn":{"time":26.808,"xyz":[15.906,0.000,72.269]}},{"noteOn":{"time":26.875,"xyz":[-35.998,0.000,-61.386]}},{"noteOn":{"time":26.933,"xyz":[-21.521,0.000,3.084]}},{"noteOn":{"time":27.000,"xyz":[-52.574,0.000,56.330]}},{"noteOn":{"time":27.058,"xyz":[46.266,0.000,-37.796]}},{"noteOn":{"time":27.125,"xyz":[-7.360,0.000,76.681]}},{"noteOn":{"time":27.183,"xyz":[71.046,0.000,68.950]}},{"noteOn":{"time":27.250,"xyz":[-6.282,0.000,39.263]}},{"noteOn":{"time":27.308,"xyz":[12.312,0.000,78.716]}},{"noteOn":{"time":27.375,"xyz":[73.131,0.000,-4.004]}},{"noteOn":{"time":27.433,"xyz":[-49.931,0.000,-37.040]}},{"noteOn":{"time":27.500,"xyz":[35.132,0.000,-61.932]}},{"noteOn":{"time":27.558,"xyz":[42.659,0.000,19.697]}},{"noteOn":{"time":27.625,"xyz":[79.464,0.000,-42.448]}},{"noteOn":{"time":27.683,"xyz":[-66.301,0.000,-22.703]}},{"noteOn":{"time":27.750,"xyz":[-94.370,0.000,27.955]}},{"noteOn":{"time":27.808,"xyz":[-69.624,0.000,99.840]}},{"noteOn":{"time":27.875,"xyz":[9.271,0.000,-25.933]}},{"noteOn":{"time":27.933,"xyz":[-83.068,0.000,-22.491]}},{"noteOn":{"time":28.000,"xyz":[-58.087,0.000,92.328]}},{"noteOn":{"time":28.058,"xyz":[94.735,0.000,-97.122]}},{"noteOn":{"time":28.125,"xyz":[36.012,0.000,90.933]}},{"noteOn":{"time":28.183,"xyz":[16.277,0.000,6.013]}},{"noteOn":{"time":28.250,"xyz":[-48.672,0.000,56.559]}},{"noteOn":{"time":28.308,"xyz":[67.386,0.000,60.573]}},{"noteOn":{"time":28.375,"xyz":[38.699,0.000,34.543]}},{"noteOn":{"time":28.433,"xyz":[-87.728,0.000,-7.959]}},{"noteOn":{"time":28.500,"xyz":[-94.247,0.000,43.835]}},{"noteOn":{"time":28.558,"xyz":[-87.688,0.000,30.339]}},{"noteOn":{"time":28.625,"xyz":[-31.467,0.000,-50.123]}},{"noteOn":{"time":28.683,"xyz":[-75.771,0.000,64.914]}},{"noteOn":{"time":28.750,"xyz":[-54.171,0.000,99.951]}},{"noteOn":{"time":28.808,"xyz":[38.953,0.000,93.379]}},{"noteOn":{"time":28.875,"xyz":[61.833,0.000,-0.785]}},{"noteOn":{"time":28.933,"xyz":[-98.420,0.000,17.501]}},{"noteOn":{"time":29.000,"xyz":[-70.071,0.000,83.923]}},{"noteOn":{"time":29.058,"xyz":[-82.132,0.000,45.194]}},{"noteOn":{"time":29.125,"xyz":[-41.373,0.000,43.873]}},{"noteOn":{"time":29.183,"xyz":[66.195,0.000,-83.241]}},{"noteOn":{"time":29.250,"xyz":[12.216,0.000,71.298]}},{"noteOn":{"time":29.308,"xyz":[58.308,0.000,-99.637]}},{"noteOn":{"time":29.375,"xyz":[36.282,0.000,80.803]}},{"noteOn":{"time":29.433,"xyz":[-9.942,0.000,-91.792]}},{"noteOn":{"time":29.500,"xyz":[-15.812,0.000,67.027]}},{"noteOn":{"time":29.558,"xyz":[57.085,0.000,-16.558]}},{"noteOn":{"time":29.625,"xyz":[-82.451,0.000,-44.039]}},{"noteOn":{"time":29.683,"xyz":[-57.332,0.000,-88.766]}},{"noteOn":{"time":29.750,"xyz":[-35.934,0.000,74.795]}},{"noteOn":{"time":29.808,"xyz":[-21.902,0.000,27.882]}},{"noteOn":{"time":29.875,"xyz":[-37.606,0.000,-73.687]}},{"noteOn":{"time":29.933,"xyz":[92.539,0.000,-47.916]}},{"noteOn":{"time":30.000,"xyz":[68.416,0.000,19.662]}},{"noteOn":{"time":30.058,"xyz":[-28.100,0.000,-45.176]}},{"noteOn":{"time":30.125,"xyz":[2.998,0.000,92.335]}},{"noteOn":{"time":30.183,"xyz":[97.176,0.000,-68.566]}},{"noteOn":{"time":30.250,"xyz":[-49.634,0.000,70.902]}},{"noteOn":{"time":30.308,"xyz":[94.682,0.000,53.651]}},{"noteOn":{"time":30.375,"xyz":[31.296,0.000,-27.094]}},{"noteOn":{"time":30.433,"xyz":[65.908,0.000,73.396]}},{"noteOn":{"time":30.500,"xyz":[-61.193,0.000,-38.088]}},{"noteOn":{"time":30.558,"xyz":[-63.954,0.000,-63.819]}},{"noteOn":{"time":30.625,"xyz":[-1.579,0.000,-55.545]}},{"noteOn":{"time":30.683,"xyz":[-70.056,0.000,-47.149]}},{"noteOn":{"time":30.750,"xyz":[-37.062,0.000,-45.928]}},{"noteOn":{"time":30.808,"xyz":[-85.067,0.000,86.355]}},{"noteOn":{"time":30.875,"xyz":[-64.550,0.000,-83.754]}},{"noteOn":{"time":30.933,"xyz":[-95.972,0.000,47.980]}},{"noteOn":{"time":31.000,"xyz":[96.542,0.000,-58.588]}},{"noteOn":{"time":31.058,"xyz":[-46.896,0.000,77.320]}},{"noteOn":{"time":31.125,"xyz":[54.804,0.000,63.659]}},{"noteOn":{"time":31.183,"xyz":[-25.926,0.000,14.855]}},{"noteOn":{"time":31.250,"xyz":[6.362,0.000,42.990]}},{"noteOn":{"time":31.308,"xyz":[85.526,0.000,-22.242]}},{"noteOn":{"time":31.375,"xyz":[-58.306,0.000,91.367]}},{"noteOn":{"time":31.433,"xyz":[-4.846,0.000,-69.014]}},{"noteOn":{"time":31.500,"xyz":[38.955,0.000,79.831]}},{"noteOn":{"time":31.558,"xyz":[17.049,0.000,-80.637]}},{"noteOn":{"time":31.625,"xyz":[-5.027,0.000,-51.734]}},{"noteOn":{"time":31.683,"xyz":[34.210,0.000,4.680]}},{"noteOn":{"time":31.750,"xyz":[-69.605,0.000,-16.691]}},{"noteOn":{"time":31.808,"xyz":[84.746,0.000,47.311]}},{"noteOn":{"time":31.875,"xyz":[-73.212,0.000,-33.969]}},{"noteOn":{"time":31.933,"xyz":[41.865,0.000,97.104]}},{"noteOn":{"time":32.000,"xyz":[-26.794,0.000,31.859]}},{"noteOn":{"time":32.058,"xyz":[-64.706,0.000,-74.382]}},{"noteOn":{"time":32.125,"xyz":[-19.613,0.000,43.193]}},{"noteOn":{"time":32.183,"xyz":[-12.283,0.000,53.908]}},{"noteOn":{"time":32.250,"xyz":[-75.107,0.000,62.878]}},{"noteOn":{"time":32.308,"xyz":[76.773,0.000,-80.737]}},{"noteOn":{"time":32.375,"xyz":[-24.532,0.000,-53.415]}},{"noteOn":{"time":32.433,"xyz":[43.478,0.000,93.303]}},{"noteOn":{"time":32.500,"xyz":[-7.547,0.000,56.692]}},{"noteOn":{"time":32.558,"xyz":[-85.760,0.000,-75.071]}},{"noteOn":{"time":32.625,"xyz":[-59.560,0.000,52.058]}},{"noteOn":{"time":32.683,"xyz":[48.346,0.000,-52.546]}},{"noteOn":{"time":32.750,"xyz":[77.235,0.000,-60.518]}},{"noteOn":{"time":32.808,"xyz":[-71.512,0.000,72.269]}},{"noteOn":{"time":32.875,"xyz":[-59.017,0.000,96.321]}},{"noteOn":{"time":32.933,"xyz":[-59.027,0.000,-95.933]}},{"noteOn":{"time":33.000,"xyz":[-85.473,0.000,-97.987]}},{"noteOn":{"time":33.058,"xyz":[-92.678,0.000,67.540]}},{"noteOn":{"time":33.125,"xyz":[-35.747,0.000,-38.207]}},{"noteOn":{"time":33.183,"xyz":[92.412,0.000,-54.950]}},{"noteOn":{"time":33.250,"xyz":[-7.755,0.000,-18.926]}},{"noteOn":{"time":33.308,"xyz":[-11.233,0.000,-98.498]}},{"noteOn":{"time":33.375,"xyz":[-31.851,0.000,-33.662]}},{"noteOn":{"time":33.433,"xyz":[-75.585,0.000,29.121]}},{"noteOn":{"time":33.500,"xyz":[-16.900,0.000,-99.522]}},{"noteOn":{"time":33.558,"xyz":[-74.446,0.000,93.452]}},{"noteOn":{"time":33.625,"xyz":[54.974,0.000,-20.246]}},{"noteOn":{"time":33.683,"xyz":[47.460,0.000,15.228]}},{"noteOn":{"time":33.750,"xyz":[74.611,0.000,18.510]}},{"noteOn":{"time":33.808,"xyz":[30.275,0.000,93.258]}},{"noteOn":{"time":33.875,"xyz":[-21.104,0.000,-61.101]}},{"noteOn":{"time":33.933,"xyz":[2.874,0.000,-26.325]}},{"noteOn":{"time":34.000,"xyz":[31.356,0.000,78.700]}},{"noteOn":{"time":34.058,"xyz":[-89.422,0.000,-86.715]}},{"noteOn":{"time":34.125,"xyz":[46.573,0.000,-16.675]}},{"noteOn":{"time":34.183,"xyz":[-56.559,0.000,81.808]}},{"noteOn":{"time":34.250,"xyz":[73.810,0.000,-89.216]}},{"noteOn":{"time":34.308,"xyz":[-46.231,0.000,-87.930]}},{"noteOn":{"time":34.375,"xyz":[-79.690,0.000,83.290]}},{"noteOn":{"time":34.433,"xyz":[36.851,0.000,-48.846]}},{"noteOn":{"time":34.500,"xyz":[-91.831,0.000,78.737]}},{"noteOn":{"time":34.558,"xyz":[-29.788,0.000,-98.363]}},{"noteOn":{"time":34.625,"xyz":[83.139,0.000,82.034]}},{"noteOn":{"time":34.683,"xyz":[26.384,0.000,82.877]}},{"noteOn":{"time":34.750,"xyz":[91.527,0.000,-77.241]}},{"noteOn":{"time":34.808,"xyz":[54.887,0.000,0.314]}},{"noteOn":{"time":34.875,"xyz":[-24.818,0.000,-75.818]}},{"noteOn":{"time":34.933,"xyz":[33.193,0.000,-1.569]}},{"noteOn":{"time":35.000,"xyz":[-33.231,0.000,92.070]}},{"noteOn":{"time":35.058,"xyz":[-23.507,0.000,-97.060]}},{"noteOn":{"time":35.125,"xyz":[60.680,0.000,92.160]}},{"noteOn":{"time":35.183,"xyz":[-65.436,0.000,42.280]}},{"noteOn":{"time":35.250,"xyz":[51.579,0.000,-84.593]}},{"noteOn":{"time":35.308,"xyz":[53.453,0.000,90.320]}},{"noteOn":{"time":35.375,"xyz":[-64.941,0.000,-77.513]}},{"noteOn":{"time":35.433,"xyz":[-97.477,0.000,-96.435]}},{"noteOn":{"time":35.500,"xyz":[15.914,0.000,6.092]}},{"noteOn":{"time":35.558,"xyz":[-73.773,0.000,-50.177]}},{"noteOn":{"time":35.625,"xyz":[31.415,0.000,-76.162]}},{"noteOn":{"time":35.683,"xyz":[-62.822,0.000,-46.403]}},{"noteOn":{"time":35.750,"xyz":[32.336,0.000,-51.461]}},{"noteOn":{"time":35.808,"xyz":[85.268,0.000,28.981]}},{"noteOn":{"time":35.875,"xyz":[-64.217,0.000,68.720]}},{"noteOn":{"time":35.933,"xyz":[79.156,0.000,-53.968]}},{"noteOn":{"time":36.000,"xyz":[-66.434,0.000,-36.910]}},{"noteOn":{"time":36.058,"xyz":[64.035,0.000,93.971]}},{"noteOn":{"time":36.125,"xyz":[-29.427,0.000,80.677]}},{"noteOn":{"time":36.183,"xyz":[35.516,0.000,76.633]}},{"noteOn":{"time":36.250,"xyz":[61.644,0.000,96.040]}},{"noteOn":{"time":36.308,"xyz":[56.408,0.000,-85.138]}},{"noteOn":{"time":36.375,"xyz":[-44.455,0.000,-11.142]}},{"noteOn":{"time":36.433,"xyz":[3.522,0.000,49.462]}},{"noteOn":{"time":36.500,"xyz":[-56.939,0.000,-68.267]}},{"noteOn":{"time":36.558,"xyz":[-32.100,0.000,-50.518]}},{"noteOn":{"time":36.625,"xyz":[-94.307,0.000,71.861]}},{"noteOn":{"time":36.683,"xyz":[-73.370,0.000,46.402]}},{"noteOn":{"time":36.750,"xyz":[-25.754,0.000,73.606]}},{"noteOn":{"time":36.808,"xyz":[-39.975,0.000,-52.190]}},{"noteOn":{"time":36.875,"xyz":[75.428,0.000,-37.304]}},{"noteOn":{"time":36.933,"xyz":[67.089,0.000,-53.129]}},{"noteOn":{"time":37.000,"xyz":[-48.222,0.000,91.051]}},{"noteOn":{"time":37.058,"xyz":[-2.787,0.000,-51.270]}},{"noteOn":{"time":37.125,"xyz":[8.415,0.000,-63.236]}},{"noteOn":{"time":37.183,"xyz":[29.509,0.000,-5.394]}},{"noteOn":{"time":37.250,"xyz":[-68.298,0.000,78.973]}},{"noteOn":{"time":37.308,"xyz":[-44.364,0.000,-8.937]}},{"noteOn":{"time":37.375,"xyz":[-97.544,0.000,54.713]}},{"noteOn":{"time":37.433,"xyz":[19.786,0.000,-41.604]}},{"noteOn":{"time":37.500,"xyz":[-47.685,0.000,26.922]}},{"noteOn":{"time":37.558,"xyz":[-96.679,0.000,-89.281]}},{"noteOn":{"time":37.625,"xyz":[48.782,0.000,82.057]}},{"noteOn":{"time":37.683,"xyz":[-26.248,0.000,83.628]}},{"noteOn":{"time":37.750,"xyz":[4.814,0.000,44.660]}},{"noteOn":{"time":37.808,"xyz":[10.929,0.000,45.860]}},{"noteOn":{"time":37.875,"xyz":[-44.862,0.000,-42.576]}},{"noteOn":{"time":37.933,"xyz":[39.923,0.000,-18.466]}},{"noteOn":{"time":38.000,"xyz":[86.159,0.000,-58.940]}},{"noteOn":{"time":38.058,"xyz":[2.574,0.000,-78.051]}},{"noteOn":{"time":38.125,"xyz":[12.032,0.000,31.317]}},{"noteOn":{"time":38.183,"xyz":[-49.267,0.000,53.008]}},{"noteOn":{"time":38.250,"xyz":[18.547,0.000,-96.807]}},{"noteOn":{"time":38.308,"xyz":[-93.946,0.000,38.550]}},{"noteOn":{"time":38.375,"xyz":[11.519,0.000,-52.753]}},{"noteOn":{"time":38.433,"xyz":[66.610,0.000,93.867]}},{"noteOn":{"time":38.500,"xyz":[-30.143,0.000,72.491]}},{"noteOn":{"time":38.558,"xyz":[-88.130,0.000,-70.230]}},{"noteOn":{"time":38.625,"xyz":[77.901,0.000,87.137]}},{"noteOn":{"time":38.683,"xyz":[-72.717,0.000,-21.568]}},{"noteOn":{"time":38.750,"xyz":[59.450,0.000,64.848]}},{"noteOn":{"time":38.808,"xyz":[0.418,0.000,-79.800]}},{"noteOn":{"time":38.875,"xyz":[19.722,0.000,-47.147]}},{"noteOn":{"time":38.933,"xyz":[-5.313,0.000,-31.695]}},{"noteOn":{"time":39.000,"xyz":[83.691,0.000,-68.453]}},{"noteOn":{"time":39.058,"xyz":[46.705,0.000,48.245]}},{"noteOn":{"time":39.125,"xyz":[-37.585,0.000,-94.262]}},{"noteOn":{"time":39.183,"xyz":[-78.147,0.000,43.216]}},{"noteOn":{"time":39.250,"xyz":[45.578,0.000,-92.119]}},{"noteOn":{"time":39.308,"xyz":[-38.009,0.000,78.707]}},{"noteOn":{"time":39.375,"xyz":[-29.000,0.000,-63.964]}},{"noteOn":{"time":39.433,"xyz":[-67.863,0.000,-99.184]}},{"noteOn":{"time":39.500,"xyz":[22.845,0.000,-53.657]}},{"noteOn":{"time":39.558,"xyz":[81.715,0.000,-23.494]}},{"noteOn":{"time":39.625,"xyz":[22.187,0.000,-15.927]}},{"noteOn":{"time":39.683,"xyz":[-56.810,0.000,-77.710]}},{"noteOn":{"time":39.750,"xyz":[-41.085,0.000,81.263]}},{"noteOn":{"time":39.808,"xyz":[59.091,0.000,63.404]}},{"noteOn":{"time":39.875,"xyz":[-64.722,0.000,-14.936]}},{"noteOn":{"time":39.933,"xyz":[-79.986,0.000,50.663]}},{"noteOn":{"time":40.000,"xyz":[11.082,0.000,-78.236]}},{"noteOn":{"time":40.058,"xyz":[-26.270,0.000,-70.384]}},{"noteOn":{"time":40.125,"xyz":[-78.782,0.000,59.439]}},{"noteOn":{"time":40.183,"xyz":[-8.490,0.000,-21.320]}},{"noteOn":{"time":40.250,"xyz":[-59.706,0.000,19.914]}},{"noteOn":{"time":40.308,"xyz":[14.692,0.000,22.174]}},{"noteOn":{"time":40.375,"xyz":[59.204,0.000,-79.458]}},{"noteOn":{"time":40.433,"xyz":[-85.137,0.000,93.133]}},{"noteOn":{"time":40.500,"xyz":[76.913,0.000,-89.051]}},{"noteOn":{"time":40.558,"xyz":[-52.686,0.000,81.928]}},{"noteOn":{"time":40.625,"xyz":[60.189,0.000,21.590]}},{"noteOn":{"time":40.683,"xyz":[-77.834,0.000,72.498]}},{"noteOn":{"time":40.750,"xyz":[46.822,0.000,72.440]}},{"noteOn":{"time":40.808,"xyz":[23.212,0.000,51.055]}},{"noteOn":{"time":40.875,"xyz":[-73.308,0.000,13.770]}},{"noteOn":{"time":40.933,"xyz":[33.639,0.000,84.780]}},{"noteOn":{"time":41.000,"xyz":[92.268,0.000,99.278]}},{"noteOn":{"time":41.058,"xyz":[42.815,0.000,-77.056]}},{"noteOn":{"time":41.125,"xyz":[-31.739,0.000,-62.661]}},{"noteOn":{"time":41.183,"xyz":[-28.177,0.000,-17.580]}},{"noteOn":{"time":41.250,"xyz":[71.797,0.000,41.364]}},{"noteOn":{"time":41.308,"xyz":[-70.184,0.000,56.351]}},{"noteOn":{"time":41.375,"xyz":[81.975,0.000,17.606]}},{"noteOn":{"time":41.433,"xyz":[61.133,0.000,-58.848]}},{"noteOn":{"time":41.500,"xyz":[73.671,0.000,-99.147]}},{"noteOn":{"time":41.558,"xyz":[26.912,0.000,-74.326]}},{"noteOn":{"time":41.625,"xyz":[57.369,0.000,-12.326]}},{"noteOn":{"time":41.683,"xyz":[-52.870,0.000,39.675]}},{"noteOn":{"time":41.750,"xyz":[27.135,0.000,-64.138]}},{"noteOn":{"time":41.808,"xyz":[-27.791,0.000,-70.757]}},{"noteOn":{"time":41.875,"xyz":[-84.858,0.000,-90.181]}},{"noteOn":{"time":41.933,"xyz":[19.895,0.000,-72.973]}},{"noteOn":{"time":42.000,"xyz":[-54.091,0.000,67.482]}},{"noteOn":{"time":42.058,"xyz":[65.662,0.000,-72.505]}},{"noteOn":{"time":42.125,"xyz":[-60.975,0.000,-82.636]}},{"noteOn":{"time":42.183,"xyz":[75.888,0.000,-25.474]}},{"noteOn":{"time":42.250,"xyz":[88.288,0.000,-63.002]}},{"noteOn":{"time":42.308,"xyz":[84.935,0.000,32.896]}},{"noteOn":{"time":42.375,"xyz":[-89.804,0.000,-51.046]}},{"noteOn":{"time":42.433,"xyz":[2.648,0.000,-40.849]}},{"noteOn":{"time":42.500,"xyz":[-31.793,0.000,10.167]}},{"noteOn":{"time":42.558,"xyz":[-39.954,0.000,23.511]}},{"noteOn":{"time":42.625,"xyz":[-96.394,0.000,-2.931]}},{"noteOn":{"time":42.683,"xyz":[-79.273,0.000,-24.743]}},{"noteOn":{"time":42.750,"xyz":[1.669,0.000,-24.544]}},{"noteOn":{"time":42.808,"xyz":[-33.826,0.000,2.068]}},{"noteOn":{"time":42.875,"xyz":[55.592,0.000,42.688]}},{"noteOn":{"time":42.933,"xyz":[67.220,0.000,-78.532]}},{"noteOn":{"time":43.000,"xyz":[22.895,0.000,-66.914]}},{"noteOn":{"time":43.058,"xyz":[-55.986,0.000,-27.586]}},{"noteOn":{"time":43.125,"xyz":[-37.842,0.000,97.949]}},{"noteOn":{"time":43.183,"xyz":[-44.725,0.000,-40.344]}},{"noteOn":{"time":43.250,"xyz":[-45.428,0.000,-78.221]}},{"noteOn":{"time":43.308,"xyz":[-92.963,0.000,55.223]}},{"noteOn":{"time":43.375,"xyz":[17.290,0.000,28.694]}},{"noteOn":{"time":43.433,"xyz":[-6.043,0.000,-7.145]}},{"noteOn":{"time":43.500,"xyz":[-33.416,0.000,-19.924]}},{"noteOn":{"time":43.558,"xyz":[45.039,0.000,-85.160]}},{"noteOn":{"time":43.625,"xyz":[50.690,0.000,78.775]}},{"noteOn":{"time":43.683,"xyz":[2.831,0.000,59.001]}},{"noteOn":{"time":43.750,"xyz":[-92.408,0.000,-10.903]}},{"noteOn":{"time":43.808,"xyz":[-16.636,0.000,19.135]}},{"noteOn":{"time":43.875,"xyz":[74.297,0.000,67.992]}},{"noteOn":{"time":43.933,"xyz":[-94.348,0.000,-12.639]}},{"noteOn":{"time":44.000,"xyz":[43.838,0.000,-6.379]}},{"noteOn":{"time":44.058,"xyz":[7.154,0.000,4.232]}},{"noteOn":{"time":44.125,"xyz":[-3.029,0.000,85.536]}},{"noteOn":{"time":44.183,"xyz":[-62.466,0.000,-85.458]}},{"noteOn":{"time":44.250,"xyz":[-10.446,0.000,-51.634]}},{"noteOn":{"time":44.308,"xyz":[10.021,0.000,66.004]}},{"noteOn":{"time":44.375,"xyz":[16.717,0.000,-49.183]}},{"noteOn":{"time":44.433,"xyz":[-50.038,0.000,-93.065]}},{"noteOn":{"time":44.500,"xyz":[-36.656,0.000,86.333]}},{"noteOn":{"time":44.558,"xyz":[-23.494,0.000,-49.804]}},{"noteOn":{"time":44.625,"xyz":[49.827,0.000,-36.450]}},{"noteOn":{"time":44.683,"xyz":[48.040,0.000,-13.513]}},{"noteOn":{"time":44.750,"xyz":[-45.076,0.000,-43.899]}},{"noteOn":{"time":44.808,"xyz":[57.698,0.000,-36.941]}},{"noteOn":{"time":44.875,"xyz":[6.299,0.000,-85.026]}},{"noteOn":{"time":44.933,"xyz":[44.332,0.000,-93.337]}},{"noteOn":{"time":45.000,"xyz":[36.582,0.000,24.938]}},{"noteOn":{"time":45.058,"xyz":[-50.599,0.000,74.363]}},{"noteOn":{"time":45.125,"xyz":[-29.062,0.000,-17.926]}},{"noteOn":{"time":45.183,"xyz":[63.689,0.000,75.484]}},{"noteOn":{"time":45.250,"xyz":[-96.259,0.000,-5.389]}},{"noteOn":{"time":45.308,"xyz":[-67.797,0.000,34.671]}},{"noteOn":{"time":45.375,"xyz":[-0.521,0.000,-23.303]}},{"noteOn":{"time":45.433,"xyz":[83.417,0.000,72.504]}},{"noteOn":{"time":45.500,"xyz":[-20.998,0.000,26.762]}},{"noteOn":{"time":45.558,"xyz":[-17.151,0.000,78.746]}},{"noteOn":{"time":45.625,"xyz":[89.136,0.000,71.412]}},{"noteOn":{"time":45.683,"xyz":[43.180,0.000,56.611]}},{"noteOn":{"time":45.750,"xyz":[64.034,0.000,-75.267]}},{"noteOn":{"time":45.808,"xyz":[16.262,0.000,36.962]}},{"noteOn":{"time":45.875,"xyz":[-67.068,0.000,-25.988]}},{"noteOn":{"time":45.933,"xyz":[9.001,0.000,11.523]}},{"noteOn":{"time":46.000,"xyz":[-26.307,0.000,-31.290]}},{"noteOn":{"time":46.058,"xyz":[-32.385,0.000,-73.398]}},{"noteOn":{"time":46.125,"xyz":[-82.801,0.000,-27.477]}},{"noteOn":{"time":46.183,"xyz":[-74.259,0.000,25.854]}},{"noteOn":{"time":46.250,"xyz":[36.743,0.000,-48.936]}},{"noteOn":{"time":46.308,"xyz":[73.812,0.000,-55.088]}},{"noteOn":{"time":46.375,"xyz":[71.615,0.000,-77.409]}},{"noteOn":{"time":46.433,"xyz":[-57.575,0.000,54.624]}},{"noteOn":{"time":46.500,"xyz":[-2.447,0.000,8.757]}},{"noteOn":{"time":46.558,"xyz":[-36.240,0.000,35.789]}},{"noteOn":{"time":46.625,"xyz":[-68.849,0.000,99.134]}},{"noteOn":{"time":46.683,"xyz":[-55.197,0.000,59.094]}},{"noteOn":{"time":46.750,"xyz":[-96.855,0.000,99.701]}},{"noteOn":{"time":46.808,"xyz":[16.803,0.000,51.973]}},{"noteOn":{"time":46.875,"xyz":[-80.683,0.000,84.117]}},{"noteOn":{"time":46.933,"xyz":[-20.497,0.000,71.787]}},{"noteOn":{"time":55.000,"xyz":[-33.796,0.000,-0.634]}},{"noteOn":{"time":55.058,"xyz":[19.928,0.000,98.695]}},{"noteOn":{"time":55.125,"xyz":[-15.373,0.000,-34.445]}},{"noteOn":{"time":55.183,"xyz":[40.340,0.000,-87.943]}},{"noteOn":{"time":55.250,"xyz":[-87.653,0.000,-95.832]}},{"noteOn":{"time":55.308,"xyz":[-16.408,0.000,31.781]}},{"noteOn":{"time":55.375,"xyz":[24.464,0.000,-5.230]}},{"noteOn":{"time":55.433,"xyz":[-91.532,0.000,34.490]}},{"noteOn":{"time":55.500,"xyz":[-17.827,0.000,-69.418]}},{"noteOn":{"time":55.558,"xyz":[-45.116,0.000,91.703]}},{"noteOn":{"time":55.625,"xyz":[-52.861,0.000,47.944]}},{"noteOn":{"time":55.683,"xyz":[99.800,0.000,-35.430]}},{"noteOn":{"time":55.750,"xyz":[9.783,0.000,3.967]}},{"noteOn":{"time":55.808,"xyz":[36.784,0.000,27.720]}},{"noteOn":{"time":55.875,"xyz":[-69.743,0.000,-83.910]}},{"noteOn":{"time":55.933,"xyz":[69.813,0.000,50.320]}},{"noteOn":{"time":56.000,"xyz":[7.749,0.000,-83.313]}},{"noteOn":{"time":56.058,"xyz":[-38.027,0.000,-87.502]}},{"noteOn":{"time":56.125,"xyz":[-56.279,0.000,-74.171]}},{"noteOn":{"time":56.183,"xyz":[-70.341,0.000,85.234]}},{"noteOn":{"time":56.250,"xyz":[14.729,0.000,95.344]}},{"noteOn":{"time":56.308,"xyz":[22.909,0.000,-48.137]}},{"noteOn":{"time":56.375,"xyz":[-79.567,0.000,27.281]}},{"noteOn":{"time":56.433,"xyz":[-17.504,0.000,99.293]}},{"noteOn":{"time":56.500,"xyz":[-77.577,0.000,-80.079]}},{"noteOn":{"time":56.558,"xyz":[-85.595,0.000,-42.921]}},{"noteOn":{"time":56.625,"xyz":[-60.500,0.000,44.452]}},{"noteOn":{"time":56.683,"xyz":[-27.686,0.000,12.479]}},{"noteOn":{"time":56.750,"xyz":[-84.980,0.000,5.425]}},{"noteOn":{"time":56.808,"xyz":[88.710,0.000,79.604]}},{"noteOn":{"time":56.875,"xyz":[21.936,0.000,88.133]}},{"noteOn":{"time":56.933,"xyz":[45.263,0.000,-49.205]}},{"noteOn":{"time":57.000,"xyz":[-78.843,0.000,46.024]}},{"noteOn":{"time":57.058,"xyz":[23.084,0.000,8.360]}},{"noteOn":{"time":57.125,"xyz":[-61.138,0.000,-68.718]}},{"noteOn":{"time":57.183,"xyz":[23.484,0.000,24.775]}},{"noteOn":{"time":57.250,"xyz":[78.370,0.000,21.690]}},{"noteOn":{"time":57.308,"xyz":[-0.123,0.000,29.499]}},{"noteOn":{"time":57.375,"xyz":[32.216,0.000,-53.082]}},{"noteOn":{"time":57.433,"xyz":[-8.569,0.000,-29.495]}},{"noteOn":{"time":57.500,"xyz":[10.046,0.000,-32.662]}},{"noteOn":{"time":57.558,"xyz":[-0.892,0.000,-51.332]}},{"noteOn":{"time":57.625,"xyz":[47.950,0.000,8.513]}},{"noteOn":{"time":57.683,"xyz":[-5.293,0.000,53.132]}},{"noteOn":{"time":57.750,"xyz":[-85.122,0.000,-95.531]}},{"noteOn":{"time":57.808,"xyz":[-96.456,0.000,75.772]}},{"noteOn":{"time":57.875,"xyz":[-18.265,0.000,-47.118]}},{"noteOn":{"time":57.933,"xyz":[51.386,0.000,32.887]}},{"noteOn":{"time":58.000,"xyz":[68.816,0.000,-64.693]}},{"noteOn":{"time":58.058,"xyz":[16.273,0.000,72.244]}},{"noteOn":{"time":58.125,"xyz":[-62.834,0.000,5.569]}},{"noteOn":{"time":58.183,"xyz":[75.843,0.000,-6.404]}},{"noteOn":{"time":58.250,"xyz":[-60.476,0.000,99.443]}},{"noteOn":{"time":58.308,"xyz":[90.790,0.000,60.808]}},{"noteOn":{"time":58.375,"xyz":[-3.540,0.000,-31.254]}},{"noteOn":{"time":58.433,"xyz":[-84.916,0.000,33.698]}},{"noteOn":{"time":58.500,"xyz":[-86.672,0.000,-7.025]}},{"noteOn":{"time":58.558,"xyz":[73.568,0.000,-2.256]}},{"noteOn":{"time":58.625,"xyz":[-96.334,0.000,-28.402]}},{"noteOn":{"time":58.683,"xyz":[97.571,0.000,19.756]}},{"noteOn":{"time":58.750,"xyz":[34.672,0.000,-49.854]}},{"noteOn":{"time":58.808,"xyz":[-40.859,0.000,-92.344]}},{"noteOn":{"time":58.875,"xyz":[-39.635,0.000,-16.788]}},{"noteOn":{"time":58.933,"xyz":[94.552,0.000,2.480]}},{"noteOn":{"time":59.000,"xyz":[-41.926,0.000,-12.512]}},{"noteOn":{"time":59.058,"xyz":[-19.264,0.000,-66.130]}},{"noteOn":{"time":59.125,"xyz":[87.974,0.000,93.890]}},{"noteOn":{"time":59.183,"xyz":[95.237,0.000,-87.430]}},{"noteOn":{"time":59.250,"xyz":[-89.538,0.000,-24.932]}},{"noteOn":{"time":59.308,"xyz":[-67.469,0.000,-22.066]}},{"noteOn":{"time":59.375,"xyz":[-76.546,0.000,86.388]}},{"noteOn":{"time":59.433,"xyz":[15.068,0.000,78.679]}},{"noteOn":{"time":59.500,"xyz":[-17.404,0.000,5.486]}},{"noteOn":{"time":59.558,"xyz":[26.206,0.000,-34.050]}},{"noteOn":{"time":59.625,"xyz":[80.799,0.000,64.621]}},{"noteOn":{"time":59.683,"xyz":[86.204,0.000,-22.153]}},{"noteOn":{"time":59.750,"xyz":[-42.871,0.000,36.484]}},{"noteOn":{"time":59.808,"xyz":[-42.689,0.000,36.657]}},{"noteOn":{"time":59.875,"xyz":[67.625,0.000,-65.740]}},{"noteOn":{"time":59.933,"xyz":[-93.917,0.000,74.403]}},{"noteOn":{"time":60.000,"xyz":[71.148,0.000,66.564]}},{"noteOn":{"time":60.058,"xyz":[1.049,0.000,-47.661]}},{"noteOn":{"time":60.125,"xyz":[33.402,0.000,-62.097]}},{"noteOn":{"time":60.183,"xyz":[73.862,0.000,-9.985]}},{"noteOn":{"time":60.250,"xyz":[2.234,0.000,35.253]}},{"noteOn":{"time":60.308,"xyz":[22.038,0.000,69.533]}},{"noteOn":{"time":60.375,"xyz":[57.353,0.000,-8.596]}},{"noteOn":{"time":60.433,"xyz":[-18.564,0.000,-69.363]}},{"noteOn":{"time":60.500,"xyz":[-12.405,0.000,65.685]}},{"noteOn":{"time":60.558,"xyz":[-53.421,0.000,-77.772]}},{"noteOn":{"time":60.625,"xyz":[-1.162,0.000,-67.302]}},{"noteOn":{"time":60.683,"xyz":[66.954,0.000,-74.031]}},{"noteOn":{"time":60.750,"xyz":[-94.284,0.000,19.680]}},{"noteOn":{"time":60.808,"xyz":[97.418,0.000,17.570]}},{"noteOn":{"time":60.875,"xyz":[-89.754,0.000,83.130]}},{"noteOn":{"time":60.933,"xyz":[-69.171,0.000,81.404]}},{"noteOn":{"time":61.000,"xyz":[-79.509,0.000,-34.684]}},{"noteOn":{"time":61.058,"xyz":[-8.981,0.000,44.064]}},{"noteOn":{"time":61.125,"xyz":[12.388,0.000,-78.714]}},{"noteOn":{"time":61.183,"xyz":[-85.739,0.000,42.487]}},{"noteOn":{"time":61.250,"xyz":[87.867,0.000,-42.984]}},{"noteOn":{"time":61.308,"xyz":[-2.678,0.000,92.280]}},{"noteOn":{"time":61.375,"xyz":[32.384,0.000,69.316]}},{"noteOn":{"time":61.433,"xyz":[-59.750,0.000,71.862]}},{"noteOn":{"time":61.500,"xyz":[-75.012,0.000,-71.882]}},{"noteOn":{"time":61.558,"xyz":[62.012,0.000,88.052]}},{"noteOn":{"time":61.625,"xyz":[-95.941,0.000,-8.232]}},{"noteOn":{"time":61.683,"xyz":[17.107,0.000,-61.270]}},{"noteOn":{"time":61.750,"xyz":[-58.170,0.000,95.958]}},{"noteOn":{"time":61.808,"xyz":[91.283,0.000,38.186]}},{"noteOn":{"time":61.875,"xyz":[30.827,0.000,6.911]}},{"noteOn":{"time":61.933,"xyz":[4.477,0.000,20.799]}},{"noteOn":{"time":62.000,"xyz":[-64.656,0.000,79.448]}},{"noteOn":{"time":62.058,"xyz":[-0.891,0.000,88.657]}},{"noteOn":{"time":62.125,"xyz":[-88.913,0.000,10.566]}},{"noteOn":{"time":62.183,"xyz":[41.851,0.000,18.741]}},{"noteOn":{"time":62.250,"xyz":[46.099,0.000,-70.851]}},{"noteOn":{"time":62.308,"xyz":[17.001,0.000,-4.682]}},{"noteOn":{"time":62.375,"xyz":[-73.890,0.000,-87.566]}},{"noteOn":{"time":62.433,"xyz":[39.579,0.000,83.140]}},{"noteOn":{"time":62.500,"xyz":[-22.583,0.000,69.858]}},{"noteOn":{"time":62.558,"xyz":[66.279,0.000,7.099]}},{"noteOn":{"time":62.625,"xyz":[90.432,0.000,-15.078]}},{"noteOn":{"time":62.683,"xyz":[32.392,0.000,-46.052]}},{"noteOn":{"time":62.750,"xyz":[-22.981,0.000,-44.324]}},{"noteOn":{"time":62.808,"xyz":[-7.163,0.000,-38.287]}},{"noteOn":{"time":62.875,"xyz":[-35.256,0.000,-75.526]}},{"noteOn":{"time":62.933,"xyz":[-4.588,0.000,-87.562]}},{"noteOn":{"time":63.000,"xyz":[64.404,0.000,-6.142]}},{"noteOn":{"time":63.058,"xyz":[25.397,0.000,-77.330]}},{"noteOn":{"time":63.125,"xyz":[43.573,0.000,-69.682]}},{"noteOn":{"time":63.183,"xyz":[55.918,0.000,31.718]}},{"noteOn":{"time":63.250,"xyz":[-76.618,0.000,-6.853]}},{"noteOn":{"time":63.308,"xyz":[-28.894,0.000,43.781]}},{"noteOn":{"time":63.375,"xyz":[-91.625,0.000,49.161]}},{"noteOn":{"time":63.433,"xyz":[-12.435,0.000,88.455]}},{"noteOn":{"time":63.500,"xyz":[-20.514,0.000,62.997]}},{"noteOn":{"time":63.558,"xyz":[7.816,0.000,-87.358]}},{"noteOn":{"time":63.625,"xyz":[71.525,0.000,16.618]}},{"noteOn":{"time":63.683,"xyz":[95.532,0.000,-9.620]}},{"noteOn":{"time":63.750,"xyz":[-71.758,0.000,-76.579]}},{"noteOn":{"time":63.808,"xyz":[95.330,0.000,77.141]}},{"noteOn":{"time":63.875,"xyz":[29.148,0.000,-44.803]}},{"noteOn":{"time":63.933,"xyz":[-70.375,0.000,86.071]}},{"noteOn":{"time":64.000,"xyz":[20.193,0.000,60.637]}},{"noteOn":{"time":64.058,"xyz":[11.469,0.000,44.392]}},{"noteOn":{"time":64.125,"xyz":[-97.517,0.000,-12.144]}},{"noteOn":{"time":64.183,"xyz":[10.961,0.000,92.213]}},{"noteOn":{"time":64.250,"xyz":[-77.536,0.000,-44.359]}},{"noteOn":{"time":64.308,"xyz":[16.121,0.000,76.087]}},{"noteOn":{"time":64.375,"xyz":[-24.049,0.000,11.282]}},{"noteOn":{"time":64.433,"xyz":[-50.376,0.000,28.108]}},{"noteOn":{"time":64.500,"xyz":[-0.486,0.000,-70.538]}},{"noteOn":{"time":64.558,"xyz":[52.990,0.000,-29.248]}},{"noteOn":{"time":64.625,"xyz":[-11.449,0.000,9.209]}},{"noteOn":{"time":64.683,"xyz":[-57.781,0.000,10.533]}},{"noteOn":{"time":64.750,"xyz":[-35.609,0.000,76.887]}},{"noteOn":{"time":64.808,"xyz":[85.910,0.000,42.308]}},{"noteOn":{"time":64.875,"xyz":[-74.548,0.000,65.145]}},{"noteOn":{"time":64.933,"xyz":[-28.826,0.000,-56.668]}},{"noteOn":{"time":65.000,"xyz":[-27.622,0.000,73.040]}},{"noteOn":{"time":65.058,"xyz":[16.605,0.000,-45.719]}},{"noteOn":{"time":65.125,"xyz":[-93.353,0.000,83.903]}},{"noteOn":{"time":65.183,"xyz":[77.675,0.000,-13.899]}},{"noteOn":{"time":65.250,"xyz":[78.883,0.000,87.191]}},{"noteOn":{"time":65.308,"xyz":[80.774,0.000,-80.941]}},{"noteOn":{"time":65.375,"xyz":[19.566,0.000,81.274]}},{"noteOn":{"time":65.433,"xyz":[-69.890,0.000,-63.646]}},{"noteOn":{"time":65.500,"xyz":[33.475,0.000,88.161]}},{"noteOn":{"time":65.558,"xyz":[69.364,0.000,21.562]}},{"noteOn":{"time":65.625,"xyz":[-7.508,0.000,-48.738]}},{"noteOn":{"time":65.683,"xyz":[-40.096,0.000,-90.458]}},{"noteOn":{"time":65.750,"xyz":[31.923,0.000,75.708]}},{"noteOn":{"time":65.808,"xyz":[-28.080,0.000,76.703]}},{"noteOn":{"time":65.875,"xyz":[55.689,0.000,70.213]}},{"noteOn":{"time":65.933,"xyz":[-13.406,0.000,-48.704]}},{"noteOn":{"time":66.000,"xyz":[98.113,0.000,22.263]}},{"noteOn":{"time":66.058,"xyz":[88.875,0.000,80.005]}},{"noteOn":{"time":66.125,"xyz":[-12.909,0.000,-52.749]}},{"noteOn":{"time":66.183,"xyz":[-95.944,0.000,66.271]}},{"noteOn":{"time":66.250,"xyz":[17.731,0.000,-40.611]}},{"noteOn":{"time":66.308,"xyz":[-90.333,0.000,-39.233]}},{"noteOn":{"time":66.375,"xyz":[-10.565,0.000,-19.638]}},{"noteOn":{"time":66.433,"xyz":[49.725,0.000,-2.032]}},{"noteOn":{"time":66.500,"xyz":[-4.425,0.000,93.351]}},{"noteOn":{"time":66.558,"xyz":[-96.459,0.000,-2.863]}},{"noteOn":{"time":66.625,"xyz":[95.721,0.000,27.528]}},{"noteOn":{"time":66.683,"xyz":[-71.291,0.000,-56.090]}},{"noteOn":{"time":66.750,"xyz":[58.373,0.000,84.151]}},{"noteOn":{"time":66.808,"xyz":[19.934,0.000,-97.521]}},{"noteOn":{"time":66.875,"xyz":[49.864,0.000,-47.730]}},{"noteOn":{"time":66.933,"xyz":[14.651,0.000,40.538]}},{"noteOn":{"time":67.000,"xyz":[74.984,0.000,72.423]}},{"noteOn":{"time":67.058,"xyz":[-54.708,0.000,42.400]}},{"noteOn":{"time":67.125,"xyz":[59.413,0.000,-47.016]}},{"noteOn":{"time":67.183,"xyz":[-0.769,0.000,-97.785]}},{"noteOn":{"time":67.250,"xyz":[-84.137,0.000,88.552]}},{"noteOn":{"time":67.308,"xyz":[13.221,0.000,91.821]}},{"noteOn":{"time":67.375,"xyz":[67.222,0.000,-64.565]}},{"noteOn":{"time":67.433,"xyz":[-87.825,0.000,-51.297]}},{"noteOn":{"time":67.500,"xyz":[-76.346,0.000,-71.610]}},{"noteOn":{"time":67.558,"xyz":[-85.179,0.000,91.454]}},{"noteOn":{"time":67.625,"xyz":[38.935,0.000,37.797]}},{"noteOn":{"time":67.683,"xyz":[-16.359,0.000,-94.507]}},{"noteOn":{"time":67.750,"xyz":[-83.215,0.000,29.959]}},{"noteOn":{"time":67.808,"xyz":[6.096,0.000,-86.924]}},{"noteOn":{"time":67.875,"xyz":[13.172,0.000,67.599]}},{"noteOn":{"time":67.933,"xyz":[-29.131,0.000,-88.639]}},{"noteOn":{"time":68.000,"xyz":[-2.042,0.000,-64.505]}},{"noteOn":{"time":68.058,"xyz":[59.315,0.000,-7.036]}},{"noteOn":{"time":68.125,"xyz":[-88.720,0.000,59.973]}},{"noteOn":{"time":68.183,"xyz":[-79.038,0.000,-82.473]}},{"noteOn":{"time":68.250,"xyz":[89.389,0.000,-26.776]}},{"noteOn":{"time":68.308,"xyz":[-44.821,0.000,42.870]}},{"noteOn":{"time":68.375,"xyz":[-46.467,0.000,16.547]}},{"noteOn":{"time":68.433,"xyz":[-8.323,0.000,-87.215]}},{"noteOn":{"time":68.500,"xyz":[-33.318,0.000,43.239]}},{"noteOn":{"time":68.558,"xyz":[62.696,0.000,97.907]}},{"noteOn":{"time":68.625,"xyz":[-21.351,0.000,-65.603]}},{"noteOn":{"time":68.683,"xyz":[2.089,0.000,-41.004]}},{"noteOn":{"time":68.750,"xyz":[13.211,0.000,41.852]}},{"noteOn":{"time":68.808,"xyz":[-96.378,0.000,-89.274]}},{"noteOn":{"time":68.875,"xyz":[13.507,0.000,84.399]}},{"noteOn":{"time":68.933,"xyz":[35.030,0.000,71.293]}},{"noteOn":{"time":69.000,"xyz":[-33.114,0.000,-91.199]}},{"noteOn":{"time":69.058,"xyz":[-51.652,0.000,-48.640]}},{"noteOn":{"time":69.125,"xyz":[89.932,0.000,-51.623]}},{"noteOn":{"time":69.183,"xyz":[63.142,0.000,27.400]}},{"noteOn":{"time":69.250,"xyz":[-18.824,0.000,-68.324]}},{"noteOn":{"time":69.308,"xyz":[40.102,0.000,-77.897]}},{"noteOn":{"time":69.375,"xyz":[-44.579,0.000,74.413]}},{"noteOn":{"time":69.433,"xyz":[20.453,0.000,40.420]}},{"noteOn":{"time":69.500,"xyz":[-27.737,0.000,-8.041]}},{"noteOn":{"time":69.558,"xyz":[-5.644,0.000,-53.197]}},{"noteOn":{"time":69.625,"xyz":[-25.302,0.000,-40.305]}},{"noteOn":{"time":69.683,"xyz":[-8.673,0.000,79.478]}},{"noteOn":{"time":69.750,"xyz":[74.210,0.000,87.027]}},{"noteOn":{"time":69.808,"xyz":[-29.704,0.000,43.948]}},{"noteOn":{"time":69.875,"xyz":[-31.044,0.000,-79.720]}},{"noteOn":{"time":69.933,"xyz":[38.675,0.000,72.590]}},{"noteOn":{"time":70.000,"xyz":[74.001,0.000,-87.484]}},{"noteOn":{"time":70.058,"xyz":[61.240,0.000,-57.087]}},{"noteOn":{"time":70.125,"xyz":[-10.325,0.000,-42.852]}},{"noteOn":{"time":70.183,"xyz":[43.297,0.000,76.132]}},{"noteOn":{"time":70.250,"xyz":[-51.650,0.000,-60.594]}},{"noteOn":{"time":70.308,"xyz":[0.874,0.000,-47.255]}},{"noteOn":{"time":70.375,"xyz":[73.884,0.000,77.917]}},{"noteOn":{"time":70.433,"xyz":[-23.764,0.000,-54.712]}},{"noteOn":{"time":70.500,"xyz":[74.136,0.000,70.215]}},{"noteOn":{"time":70.558,"xyz":[-67.813,0.000,42.863]}},{"noteOn":{"time":70.625,"xyz":[77.738,0.000,-16.401]}},{"noteOn":{"time":70.683,"xyz":[76.009,0.000,89.849]}},{"noteOn":{"time":70.750,"xyz":[-65.650,0.000,8.658]}},{"noteOn":{"time":70.808,"xyz":[35.974,0.000,-54.947]}},{"noteOn":{"time":70.875,"xyz":[-64.699,0.000,79.768]}},{"noteOn":{"time":70.933,"xyz":[52.600,0.000,-50.267]}},{"noteOn":{"time":71.000,"xyz":[-8.581,0.000,-72.833]}},{"noteOn":{"time":71.058,"xyz":[65.786,0.000,-63.885]}},{"noteOn":{"time":71.125,"xyz":[-60.610,0.000,21.522]}},{"noteOn":{"time":71.183,"xyz":[90.086,0.000,74.620]}},{"noteOn":{"time":71.250,"xyz":[49.794,0.000,66.638]}},{"noteOn":{"time":71.308,"xyz":[86.197,0.000,10.562]}},{"noteOn":{"time":71.375,"xyz":[91.365,0.000,51.602]}},{"noteOn":{"time":71.433,"xyz":[69.764,0.000,-57.952]}},{"noteOn":{"time":71.500,"xyz":[79.670,0.000,-47.229]}},{"noteOn":{"time":71.558,"xyz":[-38.733,0.000,2.722]}},{"noteOn":{"time":71.625,"xyz":[16.747,0.000,41.053]}},{"noteOn":{"time":71.683,"xyz":[85.673,0.000,98.368]}},{"noteOn":{"time":71.750,"xyz":[-76.295,0.000,-36.607]}},{"noteOn":{"time":71.808,"xyz":[-9.919,0.000,67.637]}},{"noteOn":{"time":71.875,"xyz":[-6.477,0.000,-8.196]}},{"noteOn":{"time":71.933,"xyz":[-25.637,0.000,56.931]}},{"noteOn":{"time":72.000,"xyz":[-41.361,0.000,31.133]}},{"noteOn":{"time":72.058,"xyz":[-63.773,0.000,-19.879]}},{"noteOn":{"time":72.125,"xyz":[90.024,0.000,10.529]}},{"noteOn":{"time":72.183,"xyz":[30.800,0.000,37.864]}},{"noteOn":{"time":72.250,"xyz":[33.652,0.000,-84.177]}},{"noteOn":{"time":72.308,"xyz":[-51.905,0.000,-38.639]}},{"noteOn":{"time":72.375,"xyz":[59.253,0.000,13.178]}},{"noteOn":{"time":72.433,"xyz":[-67.716,0.000,83.832]}},{"noteOn":{"time":72.500,"xyz":[57.367,0.000,-69.006]}},{"noteOn":{"time":72.558,"xyz":[-83.128,0.000,-7.570]}},{"noteOn":{"time":72.625,"xyz":[86.520,0.000,69.543]}},{"noteOn":{"time":72.683,"xyz":[-57.760,0.000,-63.850]}},{"noteOn":{"time":72.750,"xyz":[55.360,0.000,58.859]}},{"noteOn":{"time":72.808,"xyz":[69.114,0.000,24.087]}},{"noteOn":{"time":72.875,"xyz":[-62.707,0.000,-52.759]}},{"noteOn":{"time":72.933,"xyz":[-84.225,0.000,-94.382]}},{"noteOn":{"time":73.000,"xyz":[-29.957,0.000,38.144]}},{"noteOn":{"time":73.058,"xyz":[40.748,0.000,-57.752]}},{"noteOn":{"time":73.125,"xyz":[-97.901,0.000,64.485]}},{"noteOn":{"time":73.183,"xyz":[78.865,0.000,22.464]}},{"noteOn":{"time":73.250,"xyz":[-75.179,0.000,59.136]}},{"noteOn":{"time":73.308,"xyz":[-70.589,0.000,-1.516]}},{"noteOn":{"time":73.375,"xyz":[-14.619,0.000,-88.981]}},{"noteOn":{"time":73.433,"xyz":[3.051,0.000,-0.248]}},{"noteOn":{"time":73.500,"xyz":[-75.636,0.000,-49.649]}},{"noteOn":{"time":73.558,"xyz":[71.974,0.000,64.949]}},{"noteOn":{"time":73.625,"xyz":[35.176,0.000,46.593]}},{"noteOn":{"time":73.683,"xyz":[47.513,0.000,-5.342]}},{"noteOn":{"time":73.750,"xyz":[12.903,0.000,-8.840]}},{"noteOn":{"time":73.808,"xyz":[-55.862,0.000,-76.919]}},{"noteOn":{"time":73.875,"xyz":[-39.518,0.000,36.347]}},{"noteOn":{"time":73.933,"xyz":[-9.592,0.000,1.957]}},{"noteOn":{"time":74.000,"xyz":[-37.605,0.000,-65.220]}},{"noteOn":{"time":74.058,"xyz":[28.979,0.000,45.480]}},{"noteOn":{"time":74.125,"xyz":[33.202,0.000,-67.504]}},{"noteOn":{"time":74.183,"xyz":[21.339,0.000,-35.877]}},{"noteOn":{"time":74.250,"xyz":[12.458,0.000,75.983]}},{"noteOn":{"time":74.308,"xyz":[-48.691,0.000,-19.684]}},{"noteOn":{"time":74.375,"xyz":[-78.471,0.000,-38.337]}},{"noteOn":{"time":74.433,"xyz":[-83.172,0.000,-67.605]}},{"noteOn":{"time":74.500,"xyz":[33.929,0.000,47.913]}},{"noteOn":{"time":74.558,"xyz":[24.736,0.000,97.657]}},{"noteOn":{"time":74.625,"xyz":[-48.350,0.000,-72.735]}},{"noteOn":{"time":74.683,"xyz":[70.679,0.000,63.208]}},{"noteOn":{"time":74.750,"xyz":[-62.066,0.000,82.374]}},{"noteOn":{"time":74.808,"xyz":[8.290,0.000,-92.917]}},{"noteOn":{"time":74.875,"xyz":[-55.347,0.000,86.305]}},{"noteOn":{"time":74.933,"xyz":[-98.909,0.000,84.335]}},{"noteOn":{"time":75.000,"xyz":[2.343,0.000,-82.025]}},{"noteOn":{"time":75.058,"xyz":[-80.503,0.000,5.963]}},{"noteOn":{"time":75.125,"xyz":[25.495,0.000,-90.044]}},{"noteOn":{"time":75.183,"xyz":[6.410,0.000,-84.856]}},{"noteOn":{"time":75.250,"xyz":[37.480,0.000,-9.507]}},{"noteOn":{"time":75.308,"xyz":[0.775,0.000,-32.222]}},{"noteOn":{"time":75.375,"xyz":[50.921,0.000,-12.690]}},{"noteOn":{"time":75.433,"xyz":[91.385,0.000,-24.675]}},{"noteOn":{"time":75.500,"xyz":[-37.037,0.000,-10.149]}},{"noteOn":{"time":75.558,"xyz":[-13.978,0.000,-70.155]}},{"noteOn":{"time":75.625,"xyz":[-46.798,0.000,-18.339]}},{"noteOn":{"time":75.683,"xyz":[-64.193,0.000,-33.533]}},{"noteOn":{"time":75.750,"xyz":[17.559,0.000,-81.941]}},{"noteOn":{"time":75.808,"xyz":[64.277,0.000,89.847]}},{"noteOn":{"time":75.875,"xyz":[-53.433,0.000,-1.291]}},{"noteOn":{"time":75.933,"xyz":[-72.588,0.000,-39.133]}},{"noteOn":{"time":76.000,"xyz":[73.917,0.000,32.513]}},{"noteOn":{"time":76.058,"xyz":[-12.678,0.000,-29.491]}},{"noteOn":{"time":76.125,"xyz":[-6.792,0.000,-23.950]}},{"noteOn":{"time":76.183,"xyz":[-69.096,0.000,81.935]}},{"noteOn":{"time":76.250,"xyz":[-19.942,0.000,-90.977]}},{"noteOn":{"time":76.308,"xyz":[18.111,0.000,-38.169]}},{"noteOn":{"time":76.375,"xyz":[-24.273,0.000,-46.674]}},{"noteOn":{"time":76.433,"xyz":[-85.000,0.000,-89.417]}},{"noteOn":{"time":76.500,"xyz":[99.500,0.000,-91.062]}},{"noteOn":{"time":76.558,"xyz":[66.887,0.000,-99.781]}},{"noteOn":{"time":76.625,"xyz":[72.908,0.000,-67.578]}},{"noteOn":{"time":76.683,"xyz":[9.350,0.000,1.955]}},{"noteOn":{"time":76.750,"xyz":[71.893,0.000,-15.255]}},{"noteOn":{"time":76.808,"xyz":[11.876,0.000,93.916]}},{"noteOn":{"time":76.875,"xyz":[85.677,0.000,87.071]}},{"noteOn":{"time":76.933,"xyz":[-86.787,0.000,-53.107]}},{"noteOn":{"time":77.000,"xyz":[66.030,0.000,8.531]}},{"noteOn":{"time":77.058,"xyz":[51.422,0.000,54.093]}},{"noteOn":{"time":77.125,"xyz":[-89.859,0.000,-68.750]}},{"noteOn":{"time":77.183,"xyz":[27.774,0.000,62.501]}},{"noteOn":{"time":77.250,"xyz":[47.123,0.000,57.657]}},{"noteOn":{"time":77.308,"xyz":[-15.557,0.000,40.977]}},{"noteOn":{"time":77.375,"xyz":[4.563,0.000,-94.259]}},{"noteOn":{"time":77.433,"xyz":[-66.041,0.000,46.185]}},{"noteOn":{"time":77.500,"xyz":[30.207,0.000,-57.953]}},{"noteOn":{"time":77.558,"xyz":[-33.917,0.000,-15.601]}},{"noteOn":{"time":77.625,"xyz":[-52.832,0.000,92.228]}},{"noteOn":{"time":77.683,"xyz":[87.641,0.000,-22.459]}},{"noteOn":{"time":77.750,"xyz":[-58.444,0.000,-92.557]}},{"noteOn":{"time":77.808,"xyz":[-64.564,0.000,-11.876]}},{"noteOn":{"time":77.875,"xyz":[31.636,0.000,14.314]}},{"noteOn":{"time":77.933,"xyz":[54.099,0.000,-97.517]}},{"noteOn":{"time":78.000,"xyz":[-40.023,0.000,99.015]}},{"noteOn":{"time":78.058,"xyz":[-37.791,0.000,77.353]}},{"noteOn":{"time":78.125,"xyz":[97.165,0.000,-65.181]}},{"noteOn":{"time":78.183,"xyz":[53.611,0.000,83.953]}},{"noteOn":{"time":78.250,"xyz":[59.863,0.000,19.704]}},{"noteOn":{"time":78.308,"xyz":[9.217,0.000,98.754]}},{"noteOn":{"time":78.375,"xyz":[39.988,0.000,-91.251]}},{"noteOn":{"time":78.433,"xyz":[40.057,0.000,53.624]}},{"noteOn":{"time":78.500,"xyz":[-72.116,0.000,67.656]}},{"noteOn":{"time":78.558,"xyz":[57.558,0.000,-67.583]}},{"noteOn":{"time":78.625,"xyz":[-96.800,0.000,-98.701]}},{"noteOn":{"time":78.683,"xyz":[-15.601,0.000,48.949]}},{"noteOn":{"time":78.750,"xyz":[75.180,0.000,87.138]}},{"noteOn":{"time":78.808,"xyz":[-8.627,0.000,25.092]}},{"noteOn":{"time":78.875,"xyz":[91.787,0.000,-69.722]}},{"noteOn":{"time":78.933,"xyz":[84.929,0.000,69.929]}},{"noteOn":{"time":79.000,"xyz":[16.937,0.000,-82.694]}},{"noteOn":{"time":79.058,"xyz":[89.040,0.000,-95.907]}},{"noteOn":{"time":79.125,"xyz":[-90.278,0.000,42.308]}},{"noteOn":{"time":79.183,"xyz":[76.136,0.000,39.999]}},{"noteOn":{"time":79.250,"xyz":[41.224,0.000,-26.798]}},{"noteOn":{"time":79.308,"xyz":[17.697,0.000,-18.759]}},{"noteOn":{"time":79.375,"xyz":[66.008,0.000,-17.793]}},{"noteOn":{"time":79.433,"xyz":[58.094,0.000,5.372]}},{"noteOn":{"time":79.500,"xyz":[-61.037,0.000,-56.659]}},{"noteOn":{"time":79.558,"xyz":[77.953,0.000,6.221]}},{"noteOn":{"time":79.625,"xyz":[46.542,0.000,64.893]}},{"noteOn":{"time":79.683,"xyz":[-81.776,0.000,-42.750]}},{"noteOn":{"time":79.750,"xyz":[-83.099,0.000,-61.708]}},{"noteOn":{"time":79.808,"xyz":[95.675,0.000,-21.271]}},{"noteOn":{"time":79.875,"xyz":[98.672,0.000,9.213]}},{"noteOn":{"time":79.933,"xyz":[67.321,0.000,-88.746]}},{"noteOn":{"time":80.000,"xyz":[-34.528,0.000,74.595]}},{"noteOn":{"time":80.058,"xyz":[7.717,0.000,-21.221]}},{"noteOn":{"time":80.125,"xyz":[25.322,0.000,-56.943]}},{"noteOn":{"time":80.183,"xyz":[61.702,0.000,-71.548]}},{"noteOn":{"time":80.250,"xyz":[3.412,0.000,-71.588]}},{"noteOn":{"time":80.308,"xyz":[38.470,0.000,24.555]}},{"noteOn":{"time":80.375,"xyz":[35.575,0.000,39.137]}},{"noteOn":{"time":80.433,"xyz":[-66.620,0.000,12.374]}},{"noteOn":{"time":80.500,"xyz":[-28.990,0.000,-56.718]}},{"noteOn":{"time":80.558,"xyz":[14.107,0.000,-82.826]}},{"noteOn":{"time":80.625,"xyz":[-51.445,0.000,90.806]}},{"noteOn":{"time":80.683,"xyz":[-99.900,0.000,66.372]}},{"noteOn":{"time":80.750,"xyz":[93.865,0.000,-73.655]}},{"noteOn":{"time":80.808,"xyz":[11.402,0.000,81.736]}},{"noteOn":{"time":80.875,"xyz":[97.527,0.000,-12.713]}},{"noteOn":{"time":80.933,"xyz":[-22.849,0.000,-54.297]}},{"noteOn":{"time":81.000,"xyz":[-10.975,0.000,17.422]}},{"noteOn":{"time":81.058,"xyz":[-12.011,0.000,64.044]}},{"noteOn":{"time":81.125,"xyz":[-68.950,0.000,97.695]}},{"noteOn":{"time":81.183,"xyz":[62.798,0.000,88.725]}},{"noteOn":{"time":81.250,"xyz":[-64.614,0.000,-34.675]}},{"noteOn":{"time":81.308,"xyz":[90.941,0.000,-7.646]}},{"noteOn":{"time":81.375,"xyz":[-41.916,0.000,23.226]}},{"noteOn":{"time":81.433,"xyz":[-80.768,0.000,61.554]}},{"noteOn":{"time":81.500,"xyz":[80.222,0.000,-4.241]}},{"noteOn":{"time":81.558,"xyz":[-9.447,0.000,-36.449]}},{"noteOn":{"time":81.625,"xyz":[-66.083,0.000,26.876]}},{"noteOn":{"time":81.683,"xyz":[-79.108,0.000,0.590]}},{"noteOn":{"time":81.750,"xyz":[3.725,0.000,5.211]}},{"noteOn":{"time":81.808,"xyz":[36.183,0.000,-36.898]}},{"noteOn":{"time":81.875,"xyz":[33.783,0.000,-99.921]}},{"noteOn":{"time":81.933,"xyz":[92.052,0.000,-12.747]}},{"noteOn":{"time":82.000,"xyz":[-86.576,0.000,65.183]}},{"noteOn":{"time":82.058,"xyz":[81.048,0.000,-21.819]}},{"noteOn":{"time":82.125,"xyz":[11.055,0.000,75.641]}},{"noteOn":{"time":82.183,"xyz":[5.544,0.000,39.333]}},{"noteOn":{"time":82.250,"xyz":[-9.633,0.000,71.157]}},{"noteOn":{"time":82.308,"xyz":[72.838,0.000,13.332]}},{"noteOn":{"time":82.375,"xyz":[-13.122,0.000,46.323]}},{"noteOn":{"time":82.433,"xyz":[-35.524,0.000,53.312]}},{"noteOn":{"time":82.500,"xyz":[58.931,0.000,20.655]}},{"noteOn":{"time":82.558,"xyz":[-42.982,0.000,-31.959]}},{"noteOn":{"time":82.625,"xyz":[-31.871,0.000,-1.524]}},{"noteOn":{"time":82.683,"xyz":[-61.151,0.000,82.032]}},{"noteOn":{"time":82.750,"xyz":[2.142,0.000,54.783]}},{"noteOn":{"time":82.808,"xyz":[89.715,0.000,-14.397]}},{"noteOn":{"time":82.875,"xyz":[40.569,0.000,20.086]}},{"noteOn":{"time":82.933,"xyz":[-21.083,0.000,-17.898]}},{"noteOn":{"time":83.000,"xyz":[-5.621,0.000,47.623]}},{"noteOn":{"time":83.058,"xyz":[7.034,0.000,-67.348]}},{"noteOn":{"time":83.125,"xyz":[34.061,0.000,92.602]}},{"noteOn":{"time":83.183,"xyz":[77.191,0.000,-84.606]}},{"noteOn":{"time":83.250,"xyz":[73.333,0.000,-22.150]}},{"noteOn":{"time":83.308,"xyz":[47.706,0.000,-81.275]}},{"noteOn":{"time":83.375,"xyz":[-93.257,0.000,-74.058]}},{"noteOn":{"time":83.433,"xyz":[-99.055,0.000,39.023]}},{"noteOn":{"time":83.500,"xyz":[23.100,0.000,-33.048]}},{"noteOn":{"time":83.558,"xyz":[-24.072,0.000,15.249]}},{"noteOn":{"time":83.625,"xyz":[-54.989,0.000,-53.977]}},{"noteOn":{"time":83.683,"xyz":[67.103,0.000,-31.821]}},{"noteOn":{"time":83.750,"xyz":[-9.715,0.000,-81.571]}},{"noteOn":{"time":83.808,"xyz":[1.269,0.000,-16.692]}},{"noteOn":{"time":83.875,"xyz":[-73.796,0.000,-5.786]}},{"noteOn":{"time":83.933,"xyz":[81.394,0.000,46.178]}},{"noteOn":{"time":84.000,"xyz":[-95.018,0.000,-57.661]}},{"noteOn":{"time":84.058,"xyz":[42.530,0.000,69.578]}},{"noteOn":{"time":84.125,"xyz":[40.861,0.000,-51.925]}},{"noteOn":{"time":84.183,"xyz":[-86.374,0.000,-93.876]}},{"noteOn":{"time":84.250,"xyz":[28.518,0.000,-0.426]}},{"noteOn":{"time":84.308,"xyz":[-67.587,0.000,-20.194]}},{"noteOn":{"time":84.375,"xyz":[21.411,0.000,-77.238]}},{"noteOn":{"time":84.433,"xyz":[30.978,0.000,58.542]}},{"noteOn":{"time":84.500,"xyz":[-0.174,0.000,50.238]}},{"noteOn":{"time":84.558,"xyz":[-90.100,0.000,-10.808]}},{"noteOn":{"time":84.625,"xyz":[-25.798,0.000,-37.531]}},{"noteOn":{"time":84.683,"xyz":[-38.831,0.000,89.362]}},{"noteOn":{"time":84.750,"xyz":[2.331,0.000,40.495]}},{"noteOn":{"time":84.808,"xyz":[-2.816,0.000,-0.930]}},{"noteOn":{"time":84.875,"xyz":[61.708,0.000,-18.713]}},{"noteOn":{"time":84.933,"xyz":[-92.609,0.000,-97.365]}},{"noteOn":{"time":85.000,"xyz":[-76.791,0.000,-87.720]}},{"noteOn":{"time":85.058,"xyz":[-91.936,0.000,-0.752]}},{"noteOn":{"time":85.125,"xyz":[31.818,0.000,-37.156]}},{"noteOn":{"time":85.183,"xyz":[-13.132,0.000,92.344]}},{"noteOn":{"time":85.250,"xyz":[26.916,0.000,70.226]}},{"noteOn":{"time":85.308,"xyz":[-15.353,0.000,45.389]}},{"noteOn":{"time":85.375,"xyz":[41.061,0.000,78.124]}},{"noteOn":{"time":85.433,"xyz":[-85.075,0.000,-22.303]}},{"noteOn":{"time":85.500,"xyz":[-85.161,0.000,-9.803]}},{"noteOn":{"time":85.558,"xyz":[-90.751,0.000,-89.196]}},{"noteOn":{"time":85.625,"xyz":[68.665,0.000,30.808]}},{"noteOn":{"time":85.683,"xyz":[6.444,0.000,86.264]}},{"noteOn":{"time":85.750,"xyz":[-7.036,0.000,-96.199]}},{"noteOn":{"time":85.808,"xyz":[-11.629,0.000,22.037]}},{"noteOn":{"time":85.875,"xyz":[68.293,0.000,-10.459]}},{"noteOn":{"time":85.933,"xyz":[16.572,0.000,-80.647]}},{"noteOn":{"time":86.000,"xyz":[-80.582,0.000,-56.755]}},{"noteOn":{"time":86.058,"xyz":[55.613,0.000,-62.387]}},{"noteOn":{"time":86.125,"xyz":[54.365,0.000,-83.515]}},{"noteOn":{"time":86.183,"xyz":[-7.434,0.000,83.976]}},{"noteOn":{"time":86.250,"xyz":[-46.223,0.000,-19.074]}},{"noteOn":{"time":86.308,"xyz":[90.415,0.000,79.324]}},{"noteOn":{"time":86.375,"xyz":[-30.184,0.000,-48.465]}},{"noteOn":{"time":86.433,"xyz":[-41.359,0.000,-74.206]}},{"noteOn":{"time":86.500,"xyz":[-20.000,0.000,48.120]}},{"noteOn":{"time":86.558,"xyz":[99.485,0.000,75.428]}},{"noteOn":{"time":86.625,"xyz":[32.180,0.000,-38.431]}},{"noteOn":{"time":86.683,"xyz":[-94.292,0.000,47.419]}},{"noteOn":{"time":86.750,"xyz":[24.875,0.000,67.147]}},{"noteOn":{"time":86.808,"xyz":[57.809,0.000,-74.859]}},{"noteOn":{"time":86.875,"xyz":[-95.133,0.000,14.127]}},{"noteOn":{"time":86.933,"xyz":[7.861,0.000,-53.561]}},{"noteOn":{"time":87.000,"xyz":[-56.150,0.000,81.386]}},{"noteOn":{"time":87.058,"xyz":[-43.905,0.000,43.789]}},{"noteOn":{"time":87.125,"xyz":[90.506,0.000,-15.138]}},{"noteOn":{"time":87.183,"xyz":[37.506,0.000,57.541]}},{"noteOn":{"time":87.250,"xyz":[-3.890,0.000,17.524]}},{"noteOn":{"time":87.308,"xyz":[51.544,0.000,98.004]}},{"noteOn":{"time":87.375,"xyz":[-6.758,0.000,-41.836]}},{"noteOn":{"time":87.433,"xyz":[0.992,0.000,-66.884]}},{"noteOn":{"time":87.500,"xyz":[80.804,0.000,64.395]}},{"noteOn":{"time":87.558,"xyz":[68.813,0.000,-9.673]}},{"noteOn":{"time":87.625,"xyz":[-53.151,0.000,-69.675]}},{"noteOn":{"time":87.683,"xyz":[66.624,0.000,-53.286]}},{"noteOn":{"time":87.750,"xyz":[56.267,0.000,2.806]}},{"noteOn":{"time":87.808,"xyz":[-51.950,0.000,2.605]}},{"noteOn":{"time":87.875,"xyz":[-44.468,0.000,-25.390]}},{"noteOn":{"time":87.933,"xyz":[-93.063,0.000,-46.274]}},{"noteOn":{"time":88.000,"xyz":[14.128,0.000,70.708]}},{"noteOn":{"time":88.058,"xyz":[-13.124,0.000,-42.445]}},{"noteOn":{"time":88.125,"xyz":[-55.685,0.000,77.626]}},{"noteOn":{"time":88.183,"xyz":[27.105,0.000,-6.336]}},{"noteOn":{"time":88.250,"xyz":[30.181,0.000,-1.903]}},{"noteOn":{"time":88.308,"xyz":[73.184,0.000,-92.142]}},{"noteOn":{"time":88.375,"xyz":[-34.145,0.000,-93.653]}},{"noteOn":{"time":88.433,"xyz":[-98.651,0.000,-31.578]}},{"noteOn":{"time":88.500,"xyz":[-36.121,0.000,96.015]}},{"noteOn":{"time":88.558,"xyz":[-44.368,0.000,-87.827]}},{"noteOn":{"time":88.625,"xyz":[60.593,0.000,15.185]}},{"noteOn":{"time":88.683,"xyz":[-10.763,0.000,80.886]}},{"noteOn":{"time":88.750,"xyz":[-71.655,0.000,-65.969]}},{"noteOn":{"time":88.808,"xyz":[-51.286,0.000,-92.558]}},{"noteOn":{"time":88.875,"xyz":[-82.911,0.000,52.469]}},{"noteOn":{"time":88.933,"xyz":[-46.260,0.000,68.274]}},{"noteOn":{"time":89.000,"xyz":[-97.239,0.000,-9.436]}},{"noteOn":{"time":89.058,"xyz":[-80.734,0.000,-63.144]}},{"noteOn":{"time":89.125,"xyz":[-70.563,0.000,-24.280]}},{"noteOn":{"time":89.183,"xyz":[52.911,0.000,-85.429]}},{"noteOn":{"time":89.250,"xyz":[9.016,0.000,-89.555]}},{"noteOn":{"time":89.308,"xyz":[51.303,0.000,42.855]}},{"noteOn":{"time":89.375,"xyz":[98.612,0.000,-64.918]}},{"noteOn":{"time":89.433,"xyz":[-72.909,0.000,-23.552]}},{"noteOn":{"time":89.500,"xyz":[24.487,0.000,54.073]}},{"noteOn":{"time":89.558,"xyz":[-63.961,0.000,-15.444]}},{"noteOn":{"time":89.625,"xyz":[74.654,0.000,-65.702]}},{"noteOn":{"time":89.683,"xyz":[53.478,0.000,-92.975]}},{"noteOn":{"time":89.750,"xyz":[-47.173,0.000,72.549]}},{"noteOn":{"time":89.808,"xyz":[-16.007,0.000,-11.047]}},{"noteOn":{"time":89.875,"xyz":[86.531,0.000,28.597]}},{"noteOn":{"time":89.933,"xyz":[-10.036,0.000,11.870]}},{"noteOn":{"time":90.000,"xyz":[-75.363,0.000,93.161]}},{"noteOn":{"time":90.058,"xyz":[6.021,0.000,-4.702]}},{"noteOn":{"time":90.125,"xyz":[-43.414,0.000,68.875]}},{"noteOn":{"time":90.183,"xyz":[-19.892,0.000,-78.409]}},{"noteOn":{"time":90.250,"xyz":[-50.105,0.000,-50.402]}},{"noteOn":{"time":90.308,"xyz":[60.189,0.000,-97.996]}},{"noteOn":{"time":90.375,"xyz":[46.419,0.000,51.531]}},{"noteOn":{"time":90.433,"xyz":[-58.893,0.000,-84.594]}},{"noteOn":{"time":90.500,"xyz":[94.019,0.000,-58.737]}},{"noteOn":{"time":90.558,"xyz":[-88.675,0.000,-24.523]}},{"noteOn":{"time":90.625,"xyz":[31.095,0.000,-16.649]}},{"noteOn":{"time":90.683,"xyz":[-93.344,0.000,80.071]}},{"noteOn":{"time":90.750,"xyz":[99.434,0.000,56.064]}},{"noteOn":{"time":90.808,"xyz":[-99.853,0.000,30.228]}},{"noteOn":{"time":90.875,"xyz":[48.548,0.000,20.801]}},{"noteOn":{"time":90.933,"xyz":[46.565,0.000,-61.473]}},{"noteOn":{"time":91.000,"xyz":[-75.472,0.000,41.057]}},{"noteOn":{"time":91.058,"xyz":[68.842,0.000,39.653]}},{"noteOn":{"time":91.125,"xyz":[21.048,0.000,93.110]}},{"noteOn":{"time":91.183,"xyz":[35.011,0.000,32.650]}},{"noteOn":{"time":91.250,"xyz":[-78.140,0.000,-44.690]}},{"noteOn":{"time":91.308,"xyz":[39.953,0.000,86.851]}},{"noteOn":{"time":91.375,"xyz":[-4.376,0.000,68.521]}},{"noteOn":{"time":91.433,"xyz":[-10.709,0.000,-5.515]}},{"noteOn":{"time":91.500,"xyz":[27.503,0.000,89.381]}},{"noteOn":{"time":91.558,"xyz":[-4.525,0.000,14.853]}},{"noteOn":{"time":91.625,"xyz":[0.299,0.000,-26.928]}},{"noteOn":{"time":91.683,"xyz":[50.966,0.000,90.317]}},{"noteOn":{"time":91.750,"xyz":[-16.600,0.000,-14.241]}},{"noteOn":{"time":91.808,"xyz":[-46.990,0.000,-14.354]}},{"noteOn":{"time":91.875,"xyz":[-36.977,0.000,21.301]}},{"noteOn":{"time":91.933,"xyz":[-68.746,0.000,71.984]}},{"noteOn":{"time":92.000,"xyz":[64.590,0.000,-55.339]}},{"noteOn":{"time":92.058,"xyz":[-14.125,0.000,7.359]}},{"noteOn":{"time":92.125,"xyz":[90.177,0.000,68.235]}},{"noteOn":{"time":92.183,"xyz":[-7.432,0.000,19.782]}},{"noteOn":{"time":92.250,"xyz":[33.207,0.000,49.565]}},{"noteOn":{"time":92.308,"xyz":[84.024,0.000,-61.017]}},{"noteOn":{"time":92.375,"xyz":[-48.478,0.000,-57.958]}},{"noteOn":{"time":92.433,"xyz":[88.048,0.000,-88.650]}},{"noteOn":{"time":92.500,"xyz":[91.098,0.000,-3.174]}},{"noteOn":{"time":92.558,"xyz":[2.671,0.000,-67.986]}},{"noteOn":{"time":92.625,"xyz":[-31.532,0.000,-33.274]}},{"noteOn":{"time":92.683,"xyz":[30.985,0.000,-99.094]}},{"noteOn":{"time":92.750,"xyz":[52.963,0.000,63.789]}},{"noteOn":{"time":92.808,"xyz":[95.484,0.000,-81.624]}},{"noteOn":{"time":92.875,"xyz":[52.537,0.000,34.234]}},{"noteOn":{"time":92.933,"xyz":[16.001,0.000,-56.793]}},{"noteOn":{"time":93.000,"xyz":[11.861,0.000,-0.265]}},{"noteOn":{"time":93.058,"xyz":[-20.788,0.000,4.014]}},{"noteOn":{"time":93.125,"xyz":[-9.100,0.000,35.347]}},{"noteOn":{"time":93.183,"xyz":[-36.141,0.000,46.617]}},{"noteOn":{"time":93.250,"xyz":[18.992,0.000,74.069]}},{"noteOn":{"time":93.308,"xyz":[-73.349,0.000,77.526]}},{"noteOn":{"time":93.375,"xyz":[25.854,0.000,-91.250]}},{"noteOn":{"time":93.433,"xyz":[11.787,0.000,89.644]}},{"noteOn":{"time":93.500,"xyz":[-50.405,0.000,-33.903]}},{"noteOn":{"time":93.558,"xyz":[-65.209,0.000,-6.795]}},{"noteOn":{"time":93.625,"xyz":[-74.874,0.000,17.620]}},{"noteOn":{"time":93.683,"xyz":[21.172,0.000,-14.666]}},{"noteOn":{"time":93.750,"xyz":[-23.131,0.000,30.790]}},{"noteOn":{"time":93.808,"xyz":[65.040,0.000,-62.126]}},{"noteOn":{"time":93.875,"xyz":[89.866,0.000,13.147]}},{"noteOn":{"time":93.933,"xyz":[24.532,0.000,27.889]}},{"noteOn":{"time":94.000,"xyz":[-74.239,0.000,-75.108]}},{"noteOn":{"time":94.058,"xyz":[-97.611,0.000,40.882]}},{"noteOn":{"time":94.125,"xyz":[97.212,0.000,-5.666]}},{"noteOn":{"time":94.183,"xyz":[-16.400,0.000,-94.111]}},{"noteOn":{"time":94.250,"xyz":[28.528,0.000,27.758]}},{"noteOn":{"time":94.308,"xyz":[30.404,0.000,-63.357]}},{"noteOn":{"time":94.375,"xyz":[-75.695,0.000,23.462]}},{"noteOn":{"time":94.433,"xyz":[80.427,0.000,-83.516]}},{"noteOn":{"time":94.500,"xyz":[53.920,0.000,-58.705]}},{"noteOn":{"time":94.558,"xyz":[68.905,0.000,39.085]}},{"noteOn":{"time":94.625,"xyz":[-49.383,0.000,-93.405]}},{"noteOn":{"time":94.683,"xyz":[13.372,0.000,-35.052]}},{"noteOn":{"time":94.750,"xyz":[31.874,0.000,3.372]}},{"noteOn":{"time":94.808,"xyz":[71.222,0.000,-62.612]}},{"noteOn":{"time":94.875,"xyz":[85.479,0.000,-1.495]}},{"noteOn":{"time":94.933,"xyz":[19.834,0.000,-16.049]}},{"noteOn":{"time":95.000,"xyz":[45.594,0.000,-0.905]}},{"noteOn":{"time":95.058,"xyz":[-72.110,0.000,-27.607]}},{"noteOn":{"time":95.125,"xyz":[17.679,0.000,41.371]}},{"noteOn":{"time":95.183,"xyz":[-2.365,0.000,56.934]}},{"noteOn":{"time":95.250,"xyz":[12.888,0.000,-95.706]}},{"noteOn":{"time":95.308,"xyz":[73.675,0.000,-96.961]}},{"noteOn":{"time":95.375,"xyz":[34.005,0.000,96.661]}},{"noteOn":{"time":95.433,"xyz":[-53.103,0.000,-20.033]}},{"noteOn":{"time":95.500,"xyz":[28.629,0.000,-54.379]}},{"noteOn":{"time":95.558,"xyz":[44.782,0.000,22.225]}},{"noteOn":{"time":95.625,"xyz":[-96.397,0.000,79.537]}},{"noteOn":{"time":95.683,"xyz":[4.308,0.000,46.447]}},{"noteOn":{"time":95.750,"xyz":[90.240,0.000,-88.377]}},{"noteOn":{"time":95.808,"xyz":[83.142,0.000,-68.547]}},{"noteOn":{"time":95.875,"xyz":[-24.957,0.000,55.184]}},{"noteOn":{"time":95.933,"xyz":[-8.350,0.000,89.036]}},{"noteOn":{"time":96.000,"xyz":[78.047,0.000,99.160]}},{"noteOn":{"time":96.058,"xyz":[34.642,0.000,33.637]}},{"noteOn":{"time":96.125,"xyz":[82.939,0.000,-93.575]}},{"noteOn":{"time":96.183,"xyz":[50.445,0.000,63.189]}},{"noteOn":{"time":96.250,"xyz":[-87.602,0.000,-70.436]}},{"noteOn":{"time":96.308,"xyz":[38.175,0.000,53.456]}},{"noteOn":{"time":96.375,"xyz":[-88.969,0.000,31.995]}},{"noteOn":{"time":96.433,"xyz":[-15.371,0.000,-93.337]}},{"noteOn":{"time":96.500,"xyz":[59.413,0.000,-81.119]}},{"noteOn":{"time":96.558,"xyz":[-47.615,0.000,-55.386]}},{"noteOn":{"time":96.625,"xyz":[-91.429,0.000,-15.133]}},{"noteOn":{"time":96.683,"xyz":[-16.910,0.000,59.381]}},{"noteOn":{"time":96.750,"xyz":[7.238,0.000,-63.395]}},{"noteOn":{"time":96.808,"xyz":[-83.015,0.000,-6.607]}},{"noteOn":{"time":96.875,"xyz":[-93.081,0.000,9.977]}},{"noteOn":{"time":96.933,"xyz":[43.979,0.000,78.019]}},{"noteOn":{"time":97.000,"xyz":[-15.312,0.000,-62.744]}},{"noteOn":{"time":97.058,"xyz":[95.517,0.000,-22.129]}},{"noteOn":{"time":97.125,"xyz":[33.198,0.000,90.748]}},{"noteOn":{"time":97.183,"xyz":[72.642,0.000,29.691]}},{"noteOn":{"time":97.250,"xyz":[44.148,0.000,-0.816]}},{"noteOn":{"time":97.308,"xyz":[96.433,0.000,92.175]}},{"noteOn":{"time":97.375,"xyz":[-32.096,0.000,-36.225]}},{"noteOn":{"time":97.433,"xyz":[75.066,0.000,-0.880]}},{"noteOn":{"time":97.500,"xyz":[80.595,0.000,-45.020]}},{"noteOn":{"time":97.558,"xyz":[19.371,0.000,-4.849]}},{"noteOn":{"time":97.625,"xyz":[43.324,0.000,11.047]}},{"noteOn":{"time":97.683,"xyz":[-81.292,0.000,93.651]}},{"noteOn":{"time":97.750,"xyz":[8.645,0.000,-52.139]}},{"noteOn":{"time":97.808,"xyz":[-76.495,0.000,-7.177]}},{"noteOn":{"time":97.875,"xyz":[-70.337,0.000,-10.912]}},{"noteOn":{"time":97.933,"xyz":[-17.419,0.000,-19.503]}},{"noteOn":{"time":98.000,"xyz":[-30.529,0.000,98.399]}},{"noteOn":{"time":98.058,"xyz":[-35.165,0.000,14.016]}},{"noteOn":{"time":98.125,"xyz":[-94.266,0.000,4.385]}},{"noteOn":{"time":98.183,"xyz":[68.470,0.000,40.582]}},{"noteOn":{"time":98.250,"xyz":[89.480,0.000,-84.007]}},{"noteOn":{"time":98.308,"xyz":[99.302,0.000,88.517]}},{"noteOn":{"time":98.375,"xyz":[-38.910,0.000,-5.526]}},{"noteOn":{"time":98.433,"xyz":[-4.842,0.000,73.365]}},{"noteOn":{"time":98.500,"xyz":[-37.369,0.000,-60.574]}},{"noteOn":{"time":98.558,"xyz":[98.593,0.000,87.151]}},{"noteOn":{"time":98.625,"xyz":[26.486,0.000,24.076]}},{"noteOn":{"time":98.683,"xyz":[-52.463,0.000,-62.988]}},{"noteOn":{"time":98.750,"xyz":[78.248,0.000,-59.094]}},{"noteOn":{"time":98.808,"xyz":[75.524,0.000,-66.856]}},{"noteOn":{"time":98.875,"xyz":[79.528,0.000,-44.362]}},{"noteOn":{"time":98.933,"xyz":[-97.527,0.000,-41.703]}},{"noteOn":{"time":99.000,"xyz":[66.228,0.000,77.962]}},{"noteOn":{"time":99.058,"xyz":[-34.142,0.000,-55.844]}},{"noteOn":{"time":99.125,"xyz":[-77.607,0.000,-96.332]}},{"noteOn":{"time":99.183,"xyz":[-96.692,0.000,-3.398]}},{"noteOn":{"time":99.250,"xyz":[81.498,0.000,27.561]}},{"noteOn":{"time":99.308,"xyz":[63.453,0.000,14.343]}},{"noteOn":{"time":99.375,"xyz":[78.502,0.000,-67.767]}},{"noteOn":{"time":99.433,"xyz":[4.863,0.000,96.397]}},{"noteOn":{"time":99.500,"xyz":[99.610,0.000,-13.174]}},{"noteOn":{"time":99.558,"xyz":[-44.398,0.000,-4.156]}},{"noteOn":{"time":99.625,"xyz":[-94.996,0.000,-95.006]}},{"noteOn":{"time":99.683,"xyz":[-39.168,0.000,-87.433]}},{"noteOn":{"time":99.750,"xyz":[-54.659,0.000,74.734]}},{"noteOn":{"time":99.808,"xyz":[55.438,0.000,89.050]}},{"noteOn":{"time":99.875,"xyz":[67.960,0.000,47.159]}},{"noteOn":{"time":99.933,"xyz":[-24.572,0.000,-57.030]}},{"noteOn":{"time":100.000,"xyz":[-73.821,0.000,-80.834]}},{"noteOn":{"time":100.058,"xyz":[-21.705,0.000,-98.962]}},{"noteOn":{"time":100.125,"xyz":[-22.906,0.000,28.718]}},{"noteOn":{"time":100.183,"xyz":[91.166,0.000,52.595]}},{"noteOn":{"time":100.250,"xyz":[-7.439,0.000,63.681]}},{"noteOn":{"time":100.308,"xyz":[58.879,0.000,81.549]}},{"noteOn":{"time":100.375,"xyz":[26.998,0.000,28.355]}},{"noteOn":{"time":100.433,"xyz":[34.647,0.000,23.695]}},{"noteOn":{"time":100.500,"xyz":[-3.247,0.000,78.391]}},{"noteOn":{"time":100.558,"xyz":[-43.860,0.000,95.871]}},{"noteOn":{"time":100.625,"xyz":[-58.357,0.000,87.381]}},{"noteOn":{"time":100.683,"xyz":[-7.766,0.000,-83.727]}},{"noteOn":{"time":100.750,"xyz":[72.225,0.000,-90.684]}},{"noteOn":{"time":100.808,"xyz":[-57.288,0.000,-55.981]}},{"noteOn":{"time":100.875,"xyz":[-30.899,0.000,-86.901]}},{"noteOn":{"time":100.933,"xyz":[37.479,0.000,73.296]}},{"noteOn":{"time":101.000,"xyz":[5.423,0.000,50.585]}},{"noteOn":{"time":101.058,"xyz":[-74.199,0.000,85.577]}},{"noteOn":{"time":101.125,"xyz":[-76.675,0.000,-59.054]}},{"noteOn":{"time":101.183,"xyz":[-17.813,0.000,55.006]}},{"noteOn":{"time":101.250,"xyz":[-78.211,0.000,-26.125]}},{"noteOn":{"time":101.308,"xyz":[96.392,0.000,79.576]}},{"noteOn":{"time":101.375,"xyz":[-80.122,0.000,-85.194]}},{"noteOn":{"time":101.433,"xyz":[72.983,0.000,36.714]}},{"noteOn":{"time":101.500,"xyz":[57.915,0.000,99.434]}},{"noteOn":{"time":101.558,"xyz":[-46.354,0.000,98.791]}},{"noteOn":{"time":101.625,"xyz":[-97.511,0.000,94.852]}},{"noteOn":{"time":101.683,"xyz":[5.264,0.000,54.439]}},{"noteOn":{"time":101.750,"xyz":[41.710,0.000,43.097]}},{"noteOn":{"time":101.808,"xyz":[-98.621,0.000,-72.177]}},{"noteOn":{"time":101.875,"xyz":[-92.709,0.000,52.320]}},{"noteOn":{"time":101.933,"xyz":[-23.584,0.000,-67.221]}},{"noteOn":{"time":102.000,"xyz":[-47.555,0.000,-76.356]}},{"noteOn":{"time":102.058,"xyz":[63.475,0.000,-95.653]}},{"noteOn":{"time":102.125,"xyz":[61.644,0.000,60.552]}},{"noteOn":{"time":102.183,"xyz":[-49.851,0.000,-20.620]}},{"noteOn":{"time":102.250,"xyz":[82.556,0.000,-35.111]}},{"noteOn":{"time":102.308,"xyz":[15.124,0.000,-87.101]}},{"noteOn":{"time":102.375,"xyz":[-35.607,0.000,-58.283]}},{"noteOn":{"time":102.433,"xyz":[-46.148,0.000,-19.617]}},{"noteOn":{"time":102.500,"xyz":[-26.918,0.000,76.867]}},{"noteOn":{"time":102.558,"xyz":[-23.243,0.000,-9.426]}},{"noteOn":{"time":102.625,"xyz":[-55.553,0.000,78.566]}},{"noteOn":{"time":102.683,"xyz":[80.829,0.000,81.223]}},{"noteOn":{"time":102.750,"xyz":[-55.388,0.000,-49.499]}},{"noteOn":{"time":102.808,"xyz":[67.547,0.000,-45.979]}},{"noteOn":{"time":102.875,"xyz":[-55.439,0.000,-49.402]}},{"noteOn":{"time":102.933,"xyz":[-80.714,0.000,-12.849]}},{"noteOn":{"time":103.000,"xyz":[-4.391,0.000,50.120]}},{"noteOn":{"time":103.058,"xyz":[65.362,0.000,-92.909]}},{"noteOn":{"time":103.125,"xyz":[27.181,0.000,4.024]}},{"noteOn":{"time":103.183,"xyz":[-20.041,0.000,-32.134]}},{"noteOn":{"time":103.250,"xyz":[-10.004,0.000,-61.802]}},{"noteOn":{"time":103.308,"xyz":[-29.971,0.000,-61.466]}},{"noteOn":{"time":103.375,"xyz":[-50.766,0.000,-85.115]}},{"noteOn":{"time":103.433,"xyz":[-55.755,0.000,0.612]}},{"noteOn":{"time":103.500,"xyz":[-94.124,0.000,16.706]}},{"noteOn":{"time":103.558,"xyz":[-83.200,0.000,-30.895]}},{"noteOn":{"time":103.625,"xyz":[-97.256,0.000,-45.283]}},{"noteOn":{"time":103.683,"xyz":[4.716,0.000,36.137]}},{"noteOn":{"time":103.750,"xyz":[-32.742,0.000,19.429]}},{"noteOn":{"time":103.808,"xyz":[36.890,0.000,-42.541]}},{"noteOn":{"time":103.875,"xyz":[-31.860,0.000,18.122]}},{"noteOn":{"time":103.933,"xyz":[19.895,0.000,21.871]}},{"noteOn":{"time":104.000,"xyz":[-69.335,0.000,39.640]}},{"noteOn":{"time":104.058,"xyz":[-88.048,0.000,-75.789]}},{"noteOn":{"time":104.125,"xyz":[77.133,0.000,-78.360]}},{"noteOn":{"time":104.183,"xyz":[55.160,0.000,-33.287]}},{"noteOn":{"time":104.250,"xyz":[48.500,0.000,-72.498]}},{"noteOn":{"time":104.308,"xyz":[-80.621,0.000,-96.463]}},{"noteOn":{"time":104.375,"xyz":[-67.960,0.000,33.269]}},{"noteOn":{"time":104.433,"xyz":[-68.344,0.000,-18.216]}},{"noteOn":{"time":104.500,"xyz":[81.048,0.000,-58.433]}},{"noteOn":{"time":104.558,"xyz":[15.303,0.000,-18.316]}},{"noteOn":{"time":104.625,"xyz":[-21.573,0.000,-57.960]}},{"noteOn":{"time":104.683,"xyz":[55.095,0.000,81.543]}},{"noteOn":{"time":104.750,"xyz":[-21.020,0.000,-11.244]}},{"noteOn":{"time":104.808,"xyz":[-47.846,0.000,31.777]}},{"noteOn":{"time":104.875,"xyz":[-22.048,0.000,-73.003]}},{"noteOn":{"time":104.933,"xyz":[46.306,0.000,-20.376]}},{"noteOn":{"time":105.000,"xyz":[-91.755,0.000,37.185]}},{"noteOn":{"time":105.058,"xyz":[-22.320,0.000,4.278]}},{"noteOn":{"time":105.125,"xyz":[-21.728,0.000,34.966]}},{"noteOn":{"time":105.183,"xyz":[-54.573,0.000,-36.228]}},{"noteOn":{"time":105.250,"xyz":[-60.781,0.000,-63.771]}},{"noteOn":{"time":105.308,"xyz":[-87.731,0.000,82.502]}},{"noteOn":{"time":105.375,"xyz":[-73.105,0.000,26.491]}},{"noteOn":{"time":105.433,"xyz":[11.593,0.000,-15.741]}},{"noteOn":{"time":105.500,"xyz":[-28.015,0.000,-71.831]}},{"noteOn":{"time":105.558,"xyz":[-48.515,0.000,62.524]}},{"noteOn":{"time":105.625,"xyz":[25.863,0.000,99.310]}},{"noteOn":{"time":105.683,"xyz":[-9.979,0.000,-59.844]}},{"noteOn":{"time":105.750,"xyz":[-80.382,0.000,-14.166]}},{"noteOn":{"time":105.808,"xyz":[-9.344,0.000,-33.102]}},{"noteOn":{"time":105.875,"xyz":[-25.884,0.000,-51.260]}},{"noteOn":{"time":105.933,"xyz":[-31.659,0.000,-2.179]}},{"noteOn":{"time":106.000,"xyz":[21.363,0.000,-39.413]}},{"noteOn":{"time":106.058,"xyz":[-81.573,0.000,-48.476]}},{"noteOn":{"time":106.125,"xyz":[94.435,0.000,-25.641]}},{"noteOn":{"time":106.183,"xyz":[-5.934,0.000,25.995]}},{"noteOn":{"time":106.250,"xyz":[7.559,0.000,-24.969]}},{"noteOn":{"time":106.308,"xyz":[-23.887,0.000,15.061]}},{"noteOn":{"time":106.375,"xyz":[-8.171,0.000,92.340]}},{"noteOn":{"time":106.433,"xyz":[75.066,0.000,81.876]}},{"noteOn":{"time":106.500,"xyz":[88.204,0.000,-55.170]}},{"noteOn":{"time":106.558,"xyz":[-70.238,0.000,70.252]}},{"noteOn":{"time":106.625,"xyz":[40.240,0.000,62.838]}},{"noteOn":{"time":106.683,"xyz":[34.929,0.000,-67.458]}},{"noteOn":{"time":106.750,"xyz":[-12.979,0.000,-36.005]}},{"noteOn":{"time":106.808,"xyz":[51.783,0.000,-13.460]}},{"noteOn":{"time":106.875,"xyz":[44.446,0.000,91.784]}},{"noteOn":{"time":106.933,"xyz":[-54.922,0.000,46.100]}},{"noteOn":{"time":107.000,"xyz":[92.916,0.000,-61.972]}},{"noteOn":{"time":107.058,"xyz":[-40.980,0.000,63.346]}},{"noteOn":{"time":107.125,"xyz":[74.034,0.000,-83.537]}},{"noteOn":{"time":107.183,"xyz":[-94.481,0.000,-63.064]}},{"noteOn":{"time":107.250,"xyz":[50.685,0.000,99.290]}},{"noteOn":{"time":107.308,"xyz":[4.144,0.000,43.388]}},{"noteOn":{"time":107.375,"xyz":[-83.684,0.000,34.266]}},{"noteOn":{"time":107.433,"xyz":[-3.904,0.000,-0.552]}},{"noteOn":{"time":107.500,"xyz":[-37.143,0.000,88.973]}},{"noteOn":{"time":107.558,"xyz":[-32.755,0.000,25.409]}},{"noteOn":{"time":107.625,"xyz":[45.064,0.000,-16.022]}},{"noteOn":{"time":107.683,"xyz":[70.140,0.000,14.618]}},{"noteOn":{"time":107.750,"xyz":[24.546,0.000,-59.957]}},{"noteOn":{"time":107.808,"xyz":[44.490,0.000,85.706]}},{"noteOn":{"time":107.875,"xyz":[51.952,0.000,38.974]}},{"noteOn":{"time":107.933,"xyz":[-87.645,0.000,-36.174]}},{"noteOn":{"time":108.000,"xyz":[63.186,0.000,-54.458]}},{"noteOn":{"time":108.058,"xyz":[-19.271,0.000,67.805]}},{"noteOn":{"time":108.125,"xyz":[-62.451,0.000,-78.288]}},{"noteOn":{"time":108.183,"xyz":[-67.142,0.000,34.252]}},{"noteOn":{"time":108.250,"xyz":[-94.980,0.000,46.612]}},{"noteOn":{"time":108.308,"xyz":[42.917,0.000,49.692]}},{"noteOn":{"time":108.375,"xyz":[-91.225,0.000,-1.114]}},{"noteOn":{"time":108.433,"xyz":[19.213,0.000,-49.736]}},{"noteOn":{"time":108.500,"xyz":[-59.772,0.000,24.620]}},{"noteOn":{"time":108.558,"xyz":[-18.758,0.000,47.952]}},{"noteOn":{"time":108.625,"xyz":[-20.335,0.000,66.619]}},{"noteOn":{"time":108.683,"xyz":[18.354,0.000,15.152]}},{"noteOn":{"time":108.750,"xyz":[-91.444,0.000,31.762]}},{"noteOn":{"time":108.808,"xyz":[-25.194,0.000,-31.811]}},{"noteOn":{"time":108.875,"xyz":[-77.661,0.000,85.070]}},{"noteOn":{"time":108.933,"xyz":[-29.735,0.000,97.589]}},{"noteOn":{"time":109.000,"xyz":[-22.667,0.000,44.517]}},{"noteOn":{"time":109.058,"xyz":[8.771,0.000,61.125]}},{"noteOn":{"time":109.125,"xyz":[-34.970,0.000,71.830]}},{"noteOn":{"time":109.183,"xyz":[65.289,0.000,47.199]}},{"noteOn":{"time":109.250,"xyz":[33.744,0.000,74.331]}},{"noteOn":{"time":109.308,"xyz":[-20.192,0.000,-6.274]}},{"noteOn":{"time":109.375,"xyz":[84.072,0.000,13.479]}},{"noteOn":{"time":109.433,"xyz":[-53.050,0.000,73.594]}},{"noteOn":{"time":109.500,"xyz":[-36.766,0.000,19.895]}},{"noteOn":{"time":109.558,"xyz":[76.753,0.000,94.749]}},{"noteOn":{"time":109.625,"xyz":[-13.310,0.000,-95.307]}},{"noteOn":{"time":109.683,"xyz":[32.157,0.000,73.266]}},{"noteOn":{"time":109.750,"xyz":[-64.076,0.000,95.409]}},{"noteOn":{"time":109.808,"xyz":[33.328,0.000,-15.928]}},{"noteOn":{"time":109.875,"xyz":[-68.494,0.000,74.248]}},{"noteOn":{"time":109.933,"xyz":[-29.339,0.000,-61.291]}},{"noteOn":{"time":110.000,"xyz":[-27.095,0.000,19.189]}},{"noteOn":{"time":110.058,"xyz":[99.808,0.000,45.196]}},{"noteOn":{"time":110.125,"xyz":[-16.401,0.000,7.328]}},{"noteOn":{"time":110.183,"xyz":[15.651,0.000,-65.864]}},{"noteOn":{"time":110.250,"xyz":[-85.704,0.000,-2.994]}},{"noteOn":{"time":110.308,"xyz":[30.511,0.000,50.278]}},{"noteOn":{"time":110.375,"xyz":[-48.983,0.000,-76.511]}},{"noteOn":{"time":110.433,"xyz":[-72.647,0.000,72.179]}},{"noteOn":{"time":110.500,"xyz":[-39.075,0.000,-15.475]}},{"noteOn":{"time":110.558,"xyz":[33.976,0.000,97.083]}},{"noteOn":{"time":110.625,"xyz":[99.608,0.000,19.667]}},{"noteOn":{"time":110.683,"xyz":[81.517,0.000,75.931]}},{"noteOn":{"time":110.750,"xyz":[11.529,0.000,-36.778]}},{"noteOn":{"time":110.808,"xyz":[82.723,0.000,67.226]}},{"noteOn":{"time":110.875,"xyz":[-6.949,0.000,-62.406]}},{"noteOn":{"time":110.933,"xyz":[-95.346,0.000,-39.271]}},{"noteOn":{"time":127.000,"xyz":[67.331,0.000,14.148]}},{"noteOn":{"time":127.058,"xyz":[65.070,0.000,-82.703]}},{"noteOn":{"time":127.125,"xyz":[65.007,0.000,7.916]}},{"noteOn":{"time":127.183,"xyz":[-79.976,0.000,-69.125]}},{"noteOn":{"time":127.250,"xyz":[23.924,0.000,26.541]}},{"noteOn":{"time":127.308,"xyz":[-53.324,0.000,-2.621]}},{"noteOn":{"time":127.375,"xyz":[-69.976,0.000,41.473]}},{"noteOn":{"time":127.433,"xyz":[49.740,0.000,-98.067]}},{"noteOn":{"time":127.500,"xyz":[-92.663,0.000,-4.196]}},{"noteOn":{"time":127.558,"xyz":[98.154,0.000,11.831]}},{"noteOn":{"time":127.625,"xyz":[-1.949,0.000,-58.717]}},{"noteOn":{"time":127.683,"xyz":[95.471,0.000,-41.252]}},{"noteOn":{"time":127.750,"xyz":[80.913,0.000,-54.769]}},{"noteOn":{"time":127.808,"xyz":[72.812,0.000,-81.158]}},{"noteOn":{"time":127.875,"xyz":[30.612,0.000,90.112]}},{"noteOn":{"time":127.933,"xyz":[56.919,0.000,8.221]}},{"noteOn":{"time":128.000,"xyz":[-28.166,0.000,-20.257]}},{"noteOn":{"time":128.058,"xyz":[-53.534,0.000,69.236]}},{"noteOn":{"time":128.125,"xyz":[15.459,0.000,-35.312]}},{"noteOn":{"time":128.183,"xyz":[-66.076,0.000,-89.253]}},{"noteOn":{"time":128.250,"xyz":[-3.402,0.000,-97.265]}},{"noteOn":{"time":128.308,"xyz":[-99.711,0.000,95.425]}},{"noteOn":{"time":128.375,"xyz":[-72.645,0.000,90.870]}},{"noteOn":{"time":128.433,"xyz":[-51.527,0.000,-48.318]}},{"noteOn":{"time":128.500,"xyz":[93.760,0.000,-44.677]}},{"noteOn":{"time":128.558,"xyz":[-9.428,0.000,39.615]}},{"noteOn":{"time":128.625,"xyz":[28.892,0.000,-21.310]}},{"noteOn":{"time":128.683,"xyz":[27.061,0.000,-68.234]}},{"noteOn":{"time":128.750,"xyz":[-54.831,0.000,90.159]}},{"noteOn":{"time":128.808,"xyz":[-85.221,0.000,93.155]}},{"noteOn":{"time":128.875,"xyz":[70.717,0.000,-40.841]}},{"noteOn":{"time":128.933,"xyz":[-22.222,0.000,-26.643]}},{"noteOn":{"time":129.000,"xyz":[70.041,0.000,26.691]}},{"noteOn":{"time":129.058,"xyz":[33.264,0.000,-31.115]}},{"noteOn":{"time":129.125,"xyz":[0.561,0.000,94.704]}},{"noteOn":{"time":129.183,"xyz":[46.500,0.000,-10.633]}},{"noteOn":{"time":129.250,"xyz":[26.267,0.000,-15.251]}},{"noteOn":{"time":129.308,"xyz":[-43.978,0.000,-21.633]}},{"noteOn":{"time":129.375,"xyz":[40.419,0.000,-14.890]}},{"noteOn":{"time":129.433,"xyz":[-13.448,0.000,11.763]}},{"noteOn":{"time":129.500,"xyz":[3.325,0.000,43.318]}},{"noteOn":{"time":129.558,"xyz":[53.863,0.000,-64.117]}},{"noteOn":{"time":129.625,"xyz":[41.275,0.000,-59.147]}},{"noteOn":{"time":129.683,"xyz":[26.228,0.000,26.516]}},{"noteOn":{"time":129.750,"xyz":[-58.843,0.000,-78.614]}},{"noteOn":{"time":129.808,"xyz":[-96.633,0.000,61.056]}},{"noteOn":{"time":129.875,"xyz":[74.741,0.000,45.681]}},{"noteOn":{"time":129.933,"xyz":[-31.471,0.000,11.872]}},{"noteOn":{"time":130.000,"xyz":[-40.589,0.000,27.735]}},{"noteOn":{"time":130.058,"xyz":[-74.990,0.000,-98.018]}},{"noteOn":{"time":130.125,"xyz":[70.983,0.000,80.334]}},{"noteOn":{"time":130.183,"xyz":[-92.484,0.000,-73.185]}},{"noteOn":{"time":130.250,"xyz":[-68.601,0.000,76.559]}},{"noteOn":{"time":130.308,"xyz":[-76.178,0.000,-49.256]}},{"noteOn":{"time":130.375,"xyz":[-37.685,0.000,-70.731]}},{"noteOn":{"time":130.433,"xyz":[95.627,0.000,46.601]}},{"noteOn":{"time":130.500,"xyz":[87.164,0.000,15.767]}},{"noteOn":{"time":130.558,"xyz":[91.967,0.000,73.191]}},{"noteOn":{"time":130.625,"xyz":[41.826,0.000,-57.729]}},{"noteOn":{"time":130.683,"xyz":[-53.651,0.000,92.239]}},{"noteOn":{"time":130.750,"xyz":[-19.981,0.000,64.861]}},{"noteOn":{"time":130.808,"xyz":[82.602,0.000,-75.164]}},{"noteOn":{"time":130.875,"xyz":[96.427,0.000,-27.181]}},{"noteOn":{"time":130.933,"xyz":[6.623,0.000,50.791]}},{"noteOn":{"time":131.000,"xyz":[0.941,0.000,-90.736]}},{"noteOn":{"time":131.058,"xyz":[14.412,0.000,-25.226]}},{"noteOn":{"time":131.125,"xyz":[-76.318,0.000,65.081]}},{"noteOn":{"time":131.183,"xyz":[-16.660,0.000,33.367]}},{"noteOn":{"time":131.250,"xyz":[75.185,0.000,-52.037]}},{"noteOn":{"time":131.308,"xyz":[-83.827,0.000,9.478]}},{"noteOn":{"time":131.375,"xyz":[91.808,0.000,11.430]}},{"noteOn":{"time":131.433,"xyz":[-41.676,0.000,-32.307]}},{"noteOn":{"time":131.500,"xyz":[25.510,0.000,-58.657]}},{"noteOn":{"time":131.558,"xyz":[-29.263,0.000,38.352]}},{"noteOn":{"time":131.625,"xyz":[52.210,0.000,52.327]}},{"noteOn":{"time":131.683,"xyz":[-23.844,0.000,-27.880]}},{"noteOn":{"time":131.750,"xyz":[-63.627,0.000,56.104]}},{"noteOn":{"time":131.808,"xyz":[-32.198,0.000,-27.080]}},{"noteOn":{"time":131.875,"xyz":[-36.066,0.000,40.471]}},{"noteOn":{"time":131.933,"xyz":[39.237,0.000,-92.045]}},{"noteOn":{"time":132.000,"xyz":[-96.523,0.000,-45.888]}},{"noteOn":{"time":132.058,"xyz":[24.845,0.000,-98.483]}},{"noteOn":{"time":132.125,"xyz":[39.403,0.000,41.081]}},{"noteOn":{"time":132.183,"xyz":[-5.560,0.000,56.992]}},{"noteOn":{"time":132.250,"xyz":[3.045,0.000,22.076]}},{"noteOn":{"time":132.308,"xyz":[85.600,0.000,31.371]}},{"noteOn":{"time":132.375,"xyz":[70.825,0.000,-9.817]}},{"noteOn":{"time":132.433,"xyz":[45.745,0.000,-78.896]}},{"noteOn":{"time":132.500,"xyz":[-34.800,0.000,88.915]}},{"noteOn":{"time":132.558,"xyz":[-44.557,0.000,19.937]}},{"noteOn":{"time":132.625,"xyz":[46.630,0.000,82.783]}},{"noteOn":{"time":132.683,"xyz":[77.230,0.000,-9.211]}},{"noteOn":{"time":132.750,"xyz":[85.815,0.000,27.704]}},{"noteOn":{"time":132.808,"xyz":[83.072,0.000,67.364]}},{"noteOn":{"time":132.875,"xyz":[17.335,0.000,12.795]}},{"noteOn":{"time":132.933,"xyz":[20.775,0.000,-20.470]}},{"noteOn":{"time":133.000,"xyz":[-38.782,0.000,89.058]}},{"noteOn":{"time":133.058,"xyz":[-52.155,0.000,-8.028]}},{"noteOn":{"time":133.125,"xyz":[20.184,0.000,36.601]}},{"noteOn":{"time":133.183,"xyz":[-47.115,0.000,70.857]}},{"noteOn":{"time":133.250,"xyz":[80.124,0.000,62.836]}},{"noteOn":{"time":133.308,"xyz":[-37.836,0.000,-39.390]}},{"noteOn":{"time":133.375,"xyz":[-78.042,0.000,82.127]}},{"noteOn":{"time":133.433,"xyz":[54.971,0.000,-25.028]}},{"noteOn":{"time":133.500,"xyz":[-42.831,0.000,15.048]}},{"noteOn":{"time":133.558,"xyz":[48.265,0.000,-4.224]}},{"noteOn":{"time":133.625,"xyz":[89.329,0.000,-24.711]}},{"noteOn":{"time":133.683,"xyz":[21.503,0.000,41.823]}},{"noteOn":{"time":133.750,"xyz":[-57.585,0.000,-3.178]}},{"noteOn":{"time":133.808,"xyz":[98.807,0.000,31.361]}},{"noteOn":{"time":133.875,"xyz":[46.117,0.000,-94.295]}},{"noteOn":{"time":133.933,"xyz":[-49.633,0.000,-72.500]}},{"noteOn":{"time":134.000,"xyz":[91.214,0.000,-27.674]}},{"noteOn":{"time":134.058,"xyz":[-19.385,0.000,-61.090]}},{"noteOn":{"time":134.125,"xyz":[-73.152,0.000,-96.456]}},{"noteOn":{"time":134.183,"xyz":[-0.154,0.000,-39.177]}},{"noteOn":{"time":134.250,"xyz":[-71.204,0.000,62.502]}},{"noteOn":{"time":134.308,"xyz":[-9.032,0.000,-3.735]}},{"noteOn":{"time":134.375,"xyz":[-14.035,0.000,-50.632]}},{"noteOn":{"time":134.433,"xyz":[-53.443,0.000,7.003]}},{"noteOn":{"time":134.500,"xyz":[-6.043,0.000,51.501]}},{"noteOn":{"time":134.558,"xyz":[-74.200,0.000,-79.546]}},{"noteOn":{"time":134.625,"xyz":[72.088,0.000,-11.127]}},{"noteOn":{"time":134.683,"xyz":[28.759,0.000,75.243]}},{"noteOn":{"time":134.750,"xyz":[96.222,0.000,-47.312]}},{"noteOn":{"time":134.808,"xyz":[-30.808,0.000,36.731]}},{"noteOn":{"time":134.875,"xyz":[26.681,0.000,-25.624]}},{"noteOn":{"time":134.933,"xyz":[-90.630,0.000,-32.831]}},{"noteOn":{"time":135.000,"xyz":[70.867,0.000,81.086]}},{"noteOn":{"time":135.058,"xyz":[63.520,0.000,5.610]}},{"noteOn":{"time":135.125,"xyz":[16.509,0.000,-95.057]}},{"noteOn":{"time":135.183,"xyz":[43.096,0.000,-87.053]}},{"noteOn":{"time":135.250,"xyz":[66.159,0.000,-70.850]}},{"noteOn":{"time":135.308,"xyz":[69.653,0.000,-20.214]}},{"noteOn":{"time":135.375,"xyz":[59.265,0.000,87.021]}},{"noteOn":{"time":135.433,"xyz":[-17.963,0.000,-8.026]}},{"noteOn":{"time":135.500,"xyz":[47.203,0.000,-7.270]}},{"noteOn":{"time":135.558,"xyz":[76.558,0.000,-87.183]}},{"noteOn":{"time":135.625,"xyz":[51.728,0.000,87.449]}},{"noteOn":{"time":135.683,"xyz":[4.136,0.000,-14.984]}},{"noteOn":{"time":135.750,"xyz":[50.761,0.000,-55.898]}},{"noteOn":{"time":135.808,"xyz":[69.699,0.000,-8.567]}},{"noteOn":{"time":135.875,"xyz":[59.840,0.000,-99.264]}},{"noteOn":{"time":135.933,"xyz":[98.867,0.000,-45.338]}},{"noteOn":{"time":136.000,"xyz":[-24.570,0.000,-1.047]}},{"noteOn":{"time":136.058,"xyz":[17.589,0.000,13.357]}},{"noteOn":{"time":136.125,"xyz":[80.069,0.000,-97.534]}},{"noteOn":{"time":136.183,"xyz":[-5.490,0.000,-99.020]}},{"noteOn":{"time":136.250,"xyz":[-58.461,0.000,-25.820]}},{"noteOn":{"time":136.308,"xyz":[85.898,0.000,-17.490]}},{"noteOn":{"time":136.375,"xyz":[-68.557,0.000,10.707]}},{"noteOn":{"time":136.433,"xyz":[-38.582,0.000,89.233]}},{"noteOn":{"time":136.500,"xyz":[-94.851,0.000,-16.616]}},{"noteOn":{"time":136.558,"xyz":[-61.536,0.000,43.467]}},{"noteOn":{"time":136.625,"xyz":[-12.391,0.000,-72.687]}},{"noteOn":{"time":136.683,"xyz":[-24.379,0.000,96.553]}},{"noteOn":{"time":136.750,"xyz":[60.534,0.000,-33.065]}},{"noteOn":{"time":136.808,"xyz":[-65.410,0.000,-72.946]}},{"noteOn":{"time":136.875,"xyz":[-91.676,0.000,-19.025]}},{"noteOn":{"time":136.933,"xyz":[77.168,0.000,74.425]}},{"noteOn":{"time":137.000,"xyz":[15.509,0.000,-96.512]}},{"noteOn":{"time":137.058,"xyz":[82.016,0.000,-71.054]}},{"noteOn":{"time":137.125,"xyz":[-20.278,0.000,-56.089]}},{"noteOn":{"time":137.183,"xyz":[7.564,0.000,-26.131]}},{"noteOn":{"time":137.250,"xyz":[-26.012,0.000,-0.189]}},{"noteOn":{"time":137.308,"xyz":[54.924,0.000,93.154]}},{"noteOn":{"time":137.375,"xyz":[-77.254,0.000,44.056]}},{"noteOn":{"time":137.433,"xyz":[60.687,0.000,-69.802]}},{"noteOn":{"time":137.500,"xyz":[10.138,0.000,5.809]}},{"noteOn":{"time":137.558,"xyz":[36.354,0.000,-77.736]}},{"noteOn":{"time":137.625,"xyz":[79.129,0.000,44.643]}},{"noteOn":{"time":137.683,"xyz":[-68.448,0.000,54.213]}},{"noteOn":{"time":137.750,"xyz":[-31.483,0.000,51.630]}},{"noteOn":{"time":137.808,"xyz":[-5.584,0.000,-13.685]}},{"noteOn":{"time":137.875,"xyz":[-65.724,0.000,-86.961]}},{"noteOn":{"time":137.933,"xyz":[-2.691,0.000,-73.278]}},{"noteOn":{"time":138.000,"xyz":[-25.441,0.000,53.697]}},{"noteOn":{"time":138.058,"xyz":[51.660,0.000,52.177]}},{"noteOn":{"time":138.125,"xyz":[-13.554,0.000,50.711]}},{"noteOn":{"time":138.183,"xyz":[-85.165,0.000,-56.742]}},{"noteOn":{"time":138.250,"xyz":[-10.216,0.000,-13.420]}},{"noteOn":{"time":138.308,"xyz":[56.988,0.000,5.317]}},{"noteOn":{"time":138.375,"xyz":[21.588,0.000,-93.795]}},{"noteOn":{"time":138.433,"xyz":[69.306,0.000,-94.143]}},{"noteOn":{"time":138.500,"xyz":[96.115,0.000,-32.454]}},{"noteOn":{"time":138.558,"xyz":[-80.517,0.000,85.827]}},{"noteOn":{"time":138.625,"xyz":[-96.773,0.000,43.000]}},{"noteOn":{"time":138.683,"xyz":[58.121,0.000,-91.203]}},{"noteOn":{"time":138.750,"xyz":[43.666,0.000,-49.304]}},{"noteOn":{"time":138.808,"xyz":[-86.482,0.000,10.572]}},{"noteOn":{"time":138.875,"xyz":[36.754,0.000,-15.869]}},{"noteOn":{"time":138.933,"xyz":[44.554,0.000,15.140]}},{"noteOn":{"time":139.000,"xyz":[46.388,0.000,77.530]}},{"noteOn":{"time":139.058,"xyz":[14.541,0.000,3.360]}},{"noteOn":{"time":139.125,"xyz":[-82.487,0.000,5.433]}},{"noteOn":{"time":139.183,"xyz":[65.502,0.000,70.982]}},{"noteOn":{"time":139.250,"xyz":[59.933,0.000,-19.153]}},{"noteOn":{"time":139.308,"xyz":[-25.112,0.000,4.985]}},{"noteOn":{"time":139.375,"xyz":[22.045,0.000,99.301]}},{"noteOn":{"time":139.433,"xyz":[27.714,0.000,54.269]}},{"noteOn":{"time":139.500,"xyz":[26.125,0.000,-11.168]}},{"noteOn":{"time":139.558,"xyz":[99.015,0.000,-14.969]}},{"noteOn":{"time":139.625,"xyz":[-48.121,0.000,-19.170]}},{"noteOn":{"time":139.683,"xyz":[-23.129,0.000,5.054]}},{"noteOn":{"time":139.750,"xyz":[18.412,0.000,26.217]}},{"noteOn":{"time":139.808,"xyz":[-72.474,0.000,-72.688]}},{"noteOn":{"time":139.875,"xyz":[-10.773,0.000,58.214]}},{"noteOn":{"time":139.933,"xyz":[73.893,0.000,34.085]}},{"noteOn":{"time":140.000,"xyz":[72.657,0.000,59.384]}},{"noteOn":{"time":140.058,"xyz":[89.346,0.000,-89.187]}},{"noteOn":{"time":140.125,"xyz":[73.980,0.000,-60.727]}},{"noteOn":{"time":140.183,"xyz":[-37.154,0.000,-43.423]}},{"noteOn":{"time":140.250,"xyz":[-62.334,0.000,-17.708]}},{"noteOn":{"time":140.308,"xyz":[31.459,0.000,-41.979]}},{"noteOn":{"time":140.375,"xyz":[61.357,0.000,95.995]}},{"noteOn":{"time":140.433,"xyz":[64.826,0.000,-51.939]}},{"noteOn":{"time":140.500,"xyz":[29.818,0.000,90.097]}},{"noteOn":{"time":140.558,"xyz":[-14.467,0.000,-27.491]}},{"noteOn":{"time":140.625,"xyz":[-30.399,0.000,-41.042]}},{"noteOn":{"time":140.683,"xyz":[-17.806,0.000,69.177]}},{"noteOn":{"time":140.750,"xyz":[-73.838,0.000,-62.656]}},{"noteOn":{"time":140.808,"xyz":[-19.144,0.000,-62.347]}},{"noteOn":{"time":140.875,"xyz":[-22.918,0.000,-36.494]}},{"noteOn":{"time":140.933,"xyz":[47.541,0.000,-43.717]}},{"noteOn":{"time":141.000,"xyz":[-19.625,0.000,27.600]}},{"noteOn":{"time":141.058,"xyz":[-37.074,0.000,-1.640]}},{"noteOn":{"time":141.125,"xyz":[-21.803,0.000,-80.438]}},{"noteOn":{"time":141.183,"xyz":[-98.251,0.000,24.770]}},{"noteOn":{"time":141.250,"xyz":[95.943,0.000,31.415]}},{"noteOn":{"time":141.308,"xyz":[-72.923,0.000,97.677]}},{"noteOn":{"time":141.375,"xyz":[-42.570,0.000,-73.050]}},{"noteOn":{"time":141.433,"xyz":[35.534,0.000,-18.066]}},{"noteOn":{"time":141.500,"xyz":[-59.058,0.000,79.469]}},{"noteOn":{"time":141.558,"xyz":[26.529,0.000,90.154]}},{"noteOn":{"time":141.625,"xyz":[90.948,0.000,-91.904]}},{"noteOn":{"time":141.683,"xyz":[78.837,0.000,96.304]}},{"noteOn":{"time":141.750,"xyz":[-61.199,0.000,-72.200]}},{"noteOn":{"time":141.808,"xyz":[64.217,0.000,-96.150]}},{"noteOn":{"time":141.875,"xyz":[-64.884,0.000,79.986]}},{"noteOn":{"time":141.933,"xyz":[72.441,0.000,-79.719]}},{"noteOn":{"time":142.000,"xyz":[19.406,0.000,41.966]}},{"noteOn":{"time":142.058,"xyz":[27.793,0.000,-27.165]}},{"noteOn":{"time":142.125,"xyz":[-88.700,0.000,-62.734]}},{"noteOn":{"time":142.183,"xyz":[6.195,0.000,12.985]}},{"noteOn":{"time":142.250,"xyz":[-35.053,0.000,97.035]}},{"noteOn":{"time":142.308,"xyz":[-22.843,0.000,12.082]}},{"noteOn":{"time":142.375,"xyz":[-53.668,0.000,-31.666]}},{"noteOn":{"time":142.433,"xyz":[-41.793,0.000,60.157]}},{"noteOn":{"time":142.500,"xyz":[34.849,0.000,40.270]}},{"noteOn":{"time":142.558,"xyz":[43.913,0.000,56.615]}},{"noteOn":{"time":142.625,"xyz":[-21.985,0.000,-23.666]}},{"noteOn":{"time":142.683,"xyz":[19.396,0.000,38.019]}},{"noteOn":{"time":142.750,"xyz":[4.188,0.000,-86.622]}},{"noteOn":{"time":142.808,"xyz":[-47.895,0.000,-63.212]}},{"noteOn":{"time":142.875,"xyz":[85.045,0.000,-73.111]}},{"noteOn":{"time":142.933,"xyz":[37.763,0.000,-82.054]}},{"noteOn":{"time":143.000,"xyz":[-0.035,0.000,81.213]}},{"noteOn":{"time":143.058,"xyz":[-80.375,0.000,11.578]}},{"noteOn":{"time":143.125,"xyz":[50.716,0.000,94.479]}},{"noteOn":{"time":143.183,"xyz":[66.769,0.000,58.841]}},{"noteOn":{"time":143.250,"xyz":[-30.409,0.000,-36.206]}},{"noteOn":{"time":143.308,"xyz":[49.651,0.000,31.752]}},{"noteOn":{"time":143.375,"xyz":[19.796,0.000,-70.676]}},{"noteOn":{"time":143.433,"xyz":[52.191,0.000,84.069]}},{"noteOn":{"time":143.500,"xyz":[65.990,0.000,18.516]}},{"noteOn":{"time":143.558,"xyz":[-28.493,0.000,54.798]}},{"noteOn":{"time":143.625,"xyz":[-42.065,0.000,-83.350]}},{"noteOn":{"time":143.683,"xyz":[-58.179,0.000,89.851]}},{"noteOn":{"time":143.750,"xyz":[83.662,0.000,-30.559]}},{"noteOn":{"time":143.808,"xyz":[-59.694,0.000,-16.515]}},{"noteOn":{"time":143.875,"xyz":[72.994,0.000,-49.793]}},{"noteOn":{"time":143.933,"xyz":[52.402,0.000,81.966]}},{"noteOn":{"time":144.000,"xyz":[-69.884,0.000,-69.480]}},{"noteOn":{"time":144.058,"xyz":[54.767,0.000,-50.062]}},{"noteOn":{"time":144.125,"xyz":[7.659,0.000,-8.069]}},{"noteOn":{"time":144.183,"xyz":[-21.842,0.000,-12.349]}},{"noteOn":{"time":144.250,"xyz":[-32.987,0.000,-80.348]}},{"noteOn":{"time":144.308,"xyz":[-97.446,0.000,17.084]}},{"noteOn":{"time":144.375,"xyz":[62.718,0.000,39.604]}},{"noteOn":{"time":144.433,"xyz":[-24.695,0.000,39.581]}},{"noteOn":{"time":144.500,"xyz":[-94.581,0.000,-89.578]}},{"noteOn":{"time":144.558,"xyz":[-7.452,0.000,-80.632]}},{"noteOn":{"time":144.625,"xyz":[-39.621,0.000,74.400]}},{"noteOn":{"time":144.683,"xyz":[6.911,0.000,-21.224]}},{"noteOn":{"time":144.750,"xyz":[-10.464,0.000,18.422]}},{"noteOn":{"time":144.808,"xyz":[-16.605,0.000,14.593]}},{"noteOn":{"time":144.875,"xyz":[-92.994,0.000,-89.808]}},{"noteOn":{"time":144.933,"xyz":[82.481,0.000,-26.653]}},{"noteOn":{"time":145.000,"xyz":[53.277,0.000,69.010]}},{"noteOn":{"time":145.058,"xyz":[-32.278,0.000,68.771]}},{"noteOn":{"time":145.125,"xyz":[-35.366,0.000,-83.515]}},{"noteOn":{"time":145.183,"xyz":[-23.349,0.000,-0.073]}},{"noteOn":{"time":145.250,"xyz":[84.076,0.000,43.390]}},{"noteOn":{"time":145.308,"xyz":[-78.605,0.000,-54.141]}},{"noteOn":{"time":145.375,"xyz":[-9.340,0.000,36.866]}},{"noteOn":{"time":145.433,"xyz":[61.350,0.000,84.672]}},{"noteOn":{"time":145.500,"xyz":[-21.706,0.000,-50.105]}},{"noteOn":{"time":145.558,"xyz":[77.187,0.000,-75.751]}},{"noteOn":{"time":145.625,"xyz":[55.060,0.000,-25.173]}},{"noteOn":{"time":145.683,"xyz":[35.818,0.000,50.712]}},{"noteOn":{"time":145.750,"xyz":[22.601,0.000,-82.674]}},{"noteOn":{"time":145.808,"xyz":[32.234,0.000,11.895]}},{"noteOn":{"time":145.875,"xyz":[94.536,0.000,68.852]}},{"noteOn":{"time":145.933,"xyz":[-11.151,0.000,68.919]}},{"noteOn":{"time":146.000,"xyz":[85.718,0.000,-42.750]}},{"noteOn":{"time":146.058,"xyz":[48.662,0.000,81.941]}},{"noteOn":{"time":146.125,"xyz":[12.935,0.000,28.636]}},{"noteOn":{"time":146.183,"xyz":[77.637,0.000,-41.127]}},{"noteOn":{"time":146.250,"xyz":[-45.127,0.000,92.111]}},{"noteOn":{"time":146.308,"xyz":[56.747,0.000,-99.262]}},{"noteOn":{"time":146.375,"xyz":[87.346,0.000,-45.689]}},{"noteOn":{"time":146.433,"xyz":[-42.401,0.000,36.894]}},{"noteOn":{"time":146.500,"xyz":[-98.630,0.000,-3.962]}},{"noteOn":{"time":146.558,"xyz":[-80.012,0.000,-29.879]}},{"noteOn":{"time":146.625,"xyz":[-10.773,0.000,-89.446]}},{"noteOn":{"time":146.683,"xyz":[-52.455,0.000,-41.975]}},{"noteOn":{"time":146.750,"xyz":[9.623,0.000,-54.774]}},{"noteOn":{"time":146.808,"xyz":[-28.524,0.000,-44.191]}},{"noteOn":{"time":146.875,"xyz":[-20.047,0.000,-22.546]}},{"noteOn":{"time":146.933,"xyz":[-35.419,0.000,48.829]}},{"noteOn":{"time":147.000,"xyz":[54.058,0.000,-75.246]}},{"noteOn":{"time":147.058,"xyz":[80.921,0.000,-76.181]}},{"noteOn":{"time":147.125,"xyz":[90.143,0.000,-49.989]}},{"noteOn":{"time":147.183,"xyz":[-86.892,0.000,77.888]}},{"noteOn":{"time":147.250,"xyz":[-41.779,0.000,-11.266]}},{"noteOn":{"time":147.308,"xyz":[-38.282,0.000,56.769]}},{"noteOn":{"time":147.375,"xyz":[-57.834,0.000,-91.854]}},{"noteOn":{"time":147.433,"xyz":[62.304,0.000,60.867]}},{"noteOn":{"time":147.500,"xyz":[-79.494,0.000,20.651]}},{"noteOn":{"time":147.558,"xyz":[77.431,0.000,-28.078]}},{"noteOn":{"time":147.625,"xyz":[-74.829,0.000,-70.913]}},{"noteOn":{"time":147.683,"xyz":[-3.552,0.000,-52.975]}},{"noteOn":{"time":147.750,"xyz":[-59.153,0.000,90.766]}},{"noteOn":{"time":147.808,"xyz":[-42.936,0.000,12.883]}},{"noteOn":{"time":147.875,"xyz":[82.040,0.000,64.021]}},{"noteOn":{"time":147.933,"xyz":[-27.520,0.000,84.046]}},{"noteOn":{"time":148.000,"xyz":[-67.230,0.000,57.481]}},{"noteOn":{"time":148.058,"xyz":[-21.503,0.000,-63.213]}},{"noteOn":{"time":148.125,"xyz":[-82.370,0.000,-49.129]}},{"noteOn":{"time":148.183,"xyz":[-30.842,0.000,8.070]}},{"noteOn":{"time":148.250,"xyz":[55.164,0.000,-90.497]}},{"noteOn":{"time":148.308,"xyz":[-70.543,0.000,68.879]}},{"noteOn":{"time":148.375,"xyz":[-12.328,0.000,85.087]}},{"noteOn":{"time":148.433,"xyz":[-37.807,0.000,-44.217]}},{"noteOn":{"time":148.500,"xyz":[-51.837,0.000,-4.274]}},{"noteOn":{"time":148.558,"xyz":[-94.592,0.000,46.349]}},{"noteOn":{"time":148.625,"xyz":[-22.282,0.000,20.318]}},{"noteOn":{"time":148.683,"xyz":[9.732,0.000,-54.532]}},{"noteOn":{"time":148.750,"xyz":[7.492,0.000,-60.338]}},{"noteOn":{"time":148.808,"xyz":[-46.271,0.000,-76.698]}},{"noteOn":{"time":148.875,"xyz":[31.496,0.000,20.837]}},{"noteOn":{"time":148.933,"xyz":[-17.426,0.000,-76.141]}},{"noteOn":{"time":149.000,"xyz":[81.677,0.000,85.335]}},{"noteOn":{"time":149.058,"xyz":[-76.446,0.000,58.731]}},{"noteOn":{"time":149.125,"xyz":[-61.943,0.000,-62.390]}},{"noteOn":{"time":149.183,"xyz":[23.480,0.000,-74.292]}},{"noteOn":{"time":149.250,"xyz":[26.474,0.000,-28.520]}},{"noteOn":{"time":149.308,"xyz":[30.653,0.000,59.380]}},{"noteOn":{"time":149.375,"xyz":[37.082,0.000,-70.142]}},{"noteOn":{"time":149.433,"xyz":[69.970,0.000,42.904]}},{"noteOn":{"time":149.500,"xyz":[0.903,0.000,-19.046]}},{"noteOn":{"time":149.558,"xyz":[96.726,0.000,99.355]}},{"noteOn":{"time":149.625,"xyz":[-48.262,0.000,-95.984]}},{"noteOn":{"time":149.683,"xyz":[24.956,0.000,50.055]}},{"noteOn":{"time":149.750,"xyz":[39.254,0.000,-37.801]}},{"noteOn":{"time":149.808,"xyz":[72.489,0.000,-11.621]}},{"noteOn":{"time":149.875,"xyz":[-91.567,0.000,-8.059]}},{"noteOn":{"time":149.933,"xyz":[9.618,0.000,-16.622]}},{"noteOn":{"time":150.000,"xyz":[83.454,0.000,69.665]}},{"noteOn":{"time":150.058,"xyz":[-96.084,0.000,10.547]}},{"noteOn":{"time":150.125,"xyz":[52.873,0.000,40.253]}},{"noteOn":{"time":150.183,"xyz":[-17.128,0.000,19.788]}},{"noteOn":{"time":150.250,"xyz":[-89.853,0.000,-79.952]}},{"noteOn":{"time":150.308,"xyz":[51.032,0.000,5.466]}},{"noteOn":{"time":150.375,"xyz":[21.778,0.000,-67.311]}},{"noteOn":{"time":150.433,"xyz":[61.816,0.000,53.060]}},{"noteOn":{"time":150.500,"xyz":[36.888,0.000,11.219]}},{"noteOn":{"time":150.558,"xyz":[18.607,0.000,13.652]}},{"noteOn":{"time":150.625,"xyz":[79.636,0.000,17.339]}},{"noteOn":{"time":150.683,"xyz":[-72.471,0.000,13.932]}},{"noteOn":{"time":150.750,"xyz":[-58.192,0.000,0.731]}},{"noteOn":{"time":150.808,"xyz":[-91.846,0.000,58.064]}},{"noteOn":{"time":150.875,"xyz":[-20.125,0.000,-39.370]}},{"noteOn":{"time":150.933,"xyz":[-49.405,0.000,31.031]}},{"noteOn":{"time":151.000,"xyz":[-18.871,0.000,90.768]}},{"noteOn":{"time":151.058,"xyz":[50.576,0.000,83.638]}},{"noteOn":{"time":151.125,"xyz":[-40.184,0.000,-0.041]}},{"noteOn":{"time":151.183,"xyz":[-79.269,0.000,-20.507]}},{"noteOn":{"time":151.250,"xyz":[38.908,0.000,16.409]}},{"noteOn":{"time":151.308,"xyz":[28.860,0.000,-73.286]}},{"noteOn":{"time":151.375,"xyz":[-71.197,0.000,16.821]}},{"noteOn":{"time":151.433,"xyz":[-85.111,0.000,14.155]}},{"noteOn":{"time":151.500,"xyz":[-6.615,0.000,-15.899]}},{"noteOn":{"time":151.558,"xyz":[50.186,0.000,36.210]}},{"noteOn":{"time":151.625,"xyz":[-41.141,0.000,-97.677]}},{"noteOn":{"time":151.683,"xyz":[88.212,0.000,-65.808]}},{"noteOn":{"time":151.750,"xyz":[-65.697,0.000,-42.815]}},{"noteOn":{"time":151.808,"xyz":[76.823,0.000,-81.564]}},{"noteOn":{"time":151.875,"xyz":[37.263,0.000,-63.039]}},{"noteOn":{"time":151.933,"xyz":[22.212,0.000,76.069]}},{"noteOn":{"time":152.000,"xyz":[-84.421,0.000,-64.619]}},{"noteOn":{"time":152.058,"xyz":[-24.813,0.000,-72.585]}},{"noteOn":{"time":152.125,"xyz":[90.416,0.000,-43.478]}},{"noteOn":{"time":152.183,"xyz":[-85.444,0.000,81.699]}},{"noteOn":{"time":152.250,"xyz":[77.707,0.000,-74.912]}},{"noteOn":{"time":152.308,"xyz":[-7.558,0.000,72.584]}},{"noteOn":{"time":152.375,"xyz":[-61.631,0.000,-74.000]}},{"noteOn":{"time":152.433,"xyz":[-55.176,0.000,-61.338]}},{"noteOn":{"time":152.500,"xyz":[24.260,0.000,-52.624]}},{"noteOn":{"time":152.558,"xyz":[-79.989,0.000,-34.244]}},{"noteOn":{"time":152.625,"xyz":[89.391,0.000,-6.610]}},{"noteOn":{"time":152.683,"xyz":[0.618,0.000,-60.630]}},{"noteOn":{"time":152.750,"xyz":[-13.135,0.000,80.557]}},{"noteOn":{"time":152.808,"xyz":[-46.618,0.000,79.210]}},{"noteOn":{"time":152.875,"xyz":[-66.050,0.000,-54.754]}},{"noteOn":{"time":152.933,"xyz":[-1.595,0.000,56.062]}},{"noteOn":{"time":153.000,"xyz":[-36.966,0.000,-15.808]}},{"noteOn":{"time":153.058,"xyz":[-92.431,0.000,-63.203]}},{"noteOn":{"time":153.125,"xyz":[-52.513,0.000,35.865]}},{"noteOn":{"time":153.183,"xyz":[83.449,0.000,78.478]}},{"noteOn":{"time":153.250,"xyz":[61.222,0.000,1.427]}},{"noteOn":{"time":153.308,"xyz":[97.623,0.000,-90.081]}},{"noteOn":{"time":153.375,"xyz":[-38.653,0.000,11.980]}},{"noteOn":{"time":153.433,"xyz":[43.230,0.000,-88.879]}},{"noteOn":{"time":153.500,"xyz":[-62.520,0.000,-13.487]}},{"noteOn":{"time":153.558,"xyz":[43.547,0.000,-59.725]}},{"noteOn":{"time":153.625,"xyz":[11.255,0.000,4.843]}},{"noteOn":{"time":153.683,"xyz":[-81.288,0.000,76.950]}},{"noteOn":{"time":153.750,"xyz":[58.097,0.000,54.412]}},{"noteOn":{"time":153.808,"xyz":[9.007,0.000,-38.767]}},{"noteOn":{"time":153.875,"xyz":[-77.294,0.000,11.557]}},{"noteOn":{"time":153.933,"xyz":[47.835,0.000,-75.600]}},{"noteOn":{"time":154.000,"xyz":[-27.424,0.000,99.331]}},{"noteOn":{"time":154.058,"xyz":[33.204,0.000,39.710]}},{"noteOn":{"time":154.125,"xyz":[42.637,0.000,-62.455]}},{"noteOn":{"time":154.183,"xyz":[25.611,0.000,84.598]}},{"noteOn":{"time":154.250,"xyz":[31.355,0.000,-20.910]}},{"noteOn":{"time":154.308,"xyz":[-34.715,0.000,-89.556]}},{"noteOn":{"time":154.375,"xyz":[-23.224,0.000,22.024]}},{"noteOn":{"time":154.433,"xyz":[-84.805,0.000,-24.352]}},{"noteOn":{"time":154.500,"xyz":[32.616,0.000,-87.821]}},{"noteOn":{"time":154.558,"xyz":[60.669,0.000,24.511]}},{"noteOn":{"time":154.625,"xyz":[42.016,0.000,-81.631]}},{"noteOn":{"time":154.683,"xyz":[94.308,0.000,0.859]}},{"noteOn":{"time":154.750,"xyz":[-67.422,0.000,84.387]}},{"noteOn":{"time":154.808,"xyz":[-51.337,0.000,83.983]}},{"noteOn":{"time":154.875,"xyz":[-6.790,0.000,-48.777]}},{"noteOn":{"time":154.933,"xyz":[-28.610,0.000,-62.206]}},{"noteOn":{"time":155.000,"xyz":[3.638,0.000,-88.127]}},{"noteOn":{"time":155.058,"xyz":[30.739,0.000,84.589]}},{"noteOn":{"time":155.125,"xyz":[33.760,0.000,-77.746]}},{"noteOn":{"time":155.183,"xyz":[55.847,0.000,65.022]}},{"noteOn":{"time":155.250,"xyz":[74.738,0.000,57.562]}},{"noteOn":{"time":155.308,"xyz":[18.851,0.000,-61.732]}},{"noteOn":{"time":155.375,"xyz":[-30.643,0.000,86.404]}},{"noteOn":{"time":155.433,"xyz":[-83.217,0.000,23.426]}},{"noteOn":{"time":155.500,"xyz":[-61.661,0.000,-52.264]}},{"noteOn":{"time":155.558,"xyz":[-26.829,0.000,-2.535]}},{"noteOn":{"time":155.625,"xyz":[14.274,0.000,-29.464]}},{"noteOn":{"time":155.683,"xyz":[14.575,0.000,58.969]}},{"noteOn":{"time":155.750,"xyz":[58.366,0.000,-14.310]}},{"noteOn":{"time":155.808,"xyz":[48.606,0.000,53.073]}},{"noteOn":{"time":155.875,"xyz":[9.561,0.000,-43.669]}},{"noteOn":{"time":155.933,"xyz":[39.685,0.000,-56.224]}},{"noteOn":{"time":156.000,"xyz":[-36.496,0.000,-90.660]}},{"noteOn":{"time":156.058,"xyz":[9.485,0.000,27.877]}},{"noteOn":{"time":156.125,"xyz":[62.540,0.000,-0.687]}},{"noteOn":{"time":156.183,"xyz":[43.063,0.000,-77.593]}},{"noteOn":{"time":156.250,"xyz":[-39.773,0.000,-10.353]}},{"noteOn":{"time":156.308,"xyz":[21.782,0.000,37.381]}},{"noteOn":{"time":156.375,"xyz":[66.956,0.000,-94.104]}},{"noteOn":{"time":156.433,"xyz":[92.534,0.000,80.208]}},{"noteOn":{"time":156.500,"xyz":[49.921,0.000,16.739]}},{"noteOn":{"time":156.558,"xyz":[82.256,0.000,-60.106]}},{"noteOn":{"time":156.625,"xyz":[13.170,0.000,40.298]}},{"noteOn":{"time":156.683,"xyz":[39.531,0.000,-19.400]}},{"noteOn":{"time":156.750,"xyz":[-15.509,0.000,70.597]}},{"noteOn":{"time":156.808,"xyz":[93.877,0.000,-52.253]}},{"noteOn":{"time":156.875,"xyz":[47.767,0.000,-16.775]}},{"noteOn":{"time":156.933,"xyz":[30.561,0.000,68.197]}},{"noteOn":{"time":157.000,"xyz":[44.810,0.000,-76.801]}},{"noteOn":{"time":157.058,"xyz":[46.916,0.000,-78.478]}},{"noteOn":{"time":157.125,"xyz":[91.950,0.000,-85.820]}},{"noteOn":{"time":157.183,"xyz":[47.766,0.000,-15.393]}},{"noteOn":{"time":157.250,"xyz":[-23.595,0.000,-31.029]}},{"noteOn":{"time":157.308,"xyz":[15.079,0.000,19.157]}},{"noteOn":{"time":157.375,"xyz":[78.102,0.000,-60.713]}},{"noteOn":{"time":157.433,"xyz":[12.966,0.000,-6.182]}},{"noteOn":{"time":157.500,"xyz":[-33.262,0.000,30.440]}},{"noteOn":{"time":157.558,"xyz":[-73.954,0.000,21.816]}},{"noteOn":{"time":157.625,"xyz":[-86.114,0.000,36.488]}},{"noteOn":{"time":157.683,"xyz":[39.547,0.000,-35.986]}},{"noteOn":{"time":157.750,"xyz":[-1.536,0.000,35.956]}},{"noteOn":{"time":157.808,"xyz":[-84.190,0.000,-91.615]}},{"noteOn":{"time":157.875,"xyz":[-66.747,0.000,-59.993]}},{"noteOn":{"time":157.933,"xyz":[66.586,0.000,2.728]}},{"noteOn":{"time":158.000,"xyz":[-36.956,0.000,16.362]}},{"noteOn":{"time":158.058,"xyz":[-73.827,0.000,-99.516]}},{"noteOn":{"time":158.125,"xyz":[43.752,0.000,-64.057]}},{"noteOn":{"time":158.183,"xyz":[-40.435,0.000,92.171]}},{"noteOn":{"time":158.250,"xyz":[-30.917,0.000,-82.522]}},{"noteOn":{"time":158.308,"xyz":[54.780,0.000,49.854]}},{"noteOn":{"time":158.375,"xyz":[29.490,0.000,-9.129]}},{"noteOn":{"time":158.433,"xyz":[12.071,0.000,-78.350]}},{"noteOn":{"time":158.500,"xyz":[-70.236,0.000,-24.713]}},{"noteOn":{"time":158.558,"xyz":[17.072,0.000,90.004]}},{"noteOn":{"time":158.625,"xyz":[-80.861,0.000,85.324]}},{"noteOn":{"time":158.683,"xyz":[32.845,0.000,-36.079]}},{"noteOn":{"time":158.750,"xyz":[-36.230,0.000,50.685]}},{"noteOn":{"time":158.808,"xyz":[-70.474,0.000,-76.005]}},{"noteOn":{"time":158.875,"xyz":[-21.642,0.000,74.038]}},{"noteOn":{"time":158.933,"xyz":[52.553,0.000,92.361]}},{"noteOn":{"time":159.000,"xyz":[-5.954,0.000,-29.314]}},{"noteOn":{"time":159.058,"xyz":[73.558,0.000,-29.772]}},{"noteOn":{"time":159.125,"xyz":[-64.002,0.000,44.823]}},{"noteOn":{"time":159.183,"xyz":[-65.331,0.000,85.842]}},{"noteOn":{"time":159.250,"xyz":[-21.204,0.000,-27.066]}},{"noteOn":{"time":159.308,"xyz":[-50.535,0.000,38.110]}},{"noteOn":{"time":159.375,"xyz":[-96.524,0.000,-2.051]}},{"noteOn":{"time":159.433,"xyz":[24.820,0.000,18.171]}},{"noteOn":{"time":159.500,"xyz":[59.078,0.000,0.421]}},{"noteOn":{"time":159.558,"xyz":[-20.216,0.000,55.491]}},{"noteOn":{"time":159.625,"xyz":[96.688,0.000,-82.093]}},{"noteOn":{"time":159.683,"xyz":[22.998,0.000,-21.025]}},{"noteOn":{"time":159.750,"xyz":[-42.629,0.000,43.272]}},{"noteOn":{"time":159.808,"xyz":[71.436,0.000,19.723]}},{"noteOn":{"time":159.875,"xyz":[-80.167,0.000,-40.564]}},{"noteOn":{"time":159.933,"xyz":[-87.015,0.000,22.910]}},{"noteOn":{"time":160.000,"xyz":[11.506,0.000,-25.526]}},{"noteOn":{"time":160.058,"xyz":[96.038,0.000,-5.774]}},{"noteOn":{"time":160.125,"xyz":[20.526,0.000,-80.325]}},{"noteOn":{"time":160.183,"xyz":[33.391,0.000,94.060]}},{"noteOn":{"time":160.250,"xyz":[78.309,0.000,-23.575]}},{"noteOn":{"time":160.308,"xyz":[-2.249,0.000,22.448]}},{"noteOn":{"time":160.375,"xyz":[-24.417,0.000,18.331]}},{"noteOn":{"time":160.433,"xyz":[24.660,0.000,-77.587]}},{"noteOn":{"time":160.500,"xyz":[-8.642,0.000,-94.818]}},{"noteOn":{"time":160.558,"xyz":[88.042,0.000,81.067]}},{"noteOn":{"time":160.625,"xyz":[-83.169,0.000,57.720]}},{"noteOn":{"time":160.683,"xyz":[36.431,0.000,-60.726]}},{"noteOn":{"time":160.750,"xyz":[-92.793,0.000,-10.724]}},{"noteOn":{"time":160.808,"xyz":[-63.261,0.000,44.343]}},{"noteOn":{"time":160.875,"xyz":[56.345,0.000,84.576]}},{"noteOn":{"time":160.933,"xyz":[29.628,0.000,-91.494]}},{"noteOn":{"time":161.000,"xyz":[-75.534,0.000,-90.027]}},{"noteOn":{"time":161.058,"xyz":[-81.255,0.000,81.462]}},{"noteOn":{"time":161.125,"xyz":[-79.532,0.000,-74.514]}},{"noteOn":{"time":161.183,"xyz":[57.644,0.000,20.460]}},{"noteOn":{"time":161.250,"xyz":[10.110,0.000,-40.144]}},{"noteOn":{"time":161.308,"xyz":[-74.206,0.000,-41.227]}},{"noteOn":{"time":161.375,"xyz":[-48.004,0.000,17.834]}},{"noteOn":{"time":161.433,"xyz":[61.013,0.000,45.484]}},{"noteOn":{"time":161.500,"xyz":[-82.614,0.000,26.601]}},{"noteOn":{"time":161.558,"xyz":[2.622,0.000,-31.220]}},{"noteOn":{"time":161.625,"xyz":[-10.097,0.000,8.129]}},{"noteOn":{"time":161.683,"xyz":[-40.078,0.000,-6.135]}},{"noteOn":{"time":161.750,"xyz":[29.692,0.000,-1.175]}},{"noteOn":{"time":161.808,"xyz":[-83.077,0.000,57.766]}},{"noteOn":{"time":161.875,"xyz":[-14.026,0.000,39.593]}},{"noteOn":{"time":161.933,"xyz":[78.956,0.000,-20.897]}},{"noteOn":{"time":162.000,"xyz":[-85.180,0.000,40.878]}},{"noteOn":{"time":162.058,"xyz":[-77.527,0.000,-26.077]}},{"noteOn":{"time":162.125,"xyz":[-32.259,0.000,-99.124]}},{"noteOn":{"time":162.183,"xyz":[-11.556,0.000,31.372]}},{"noteOn":{"time":162.250,"xyz":[23.916,0.000,33.455]}},{"noteOn":{"time":162.308,"xyz":[24.791,0.000,-92.127]}},{"noteOn":{"time":162.375,"xyz":[-92.933,0.000,57.783]}},{"noteOn":{"time":162.433,"xyz":[96.780,0.000,58.058]}},{"noteOn":{"time":162.500,"xyz":[19.542,0.000,-73.092]}},{"noteOn":{"time":162.558,"xyz":[-91.285,0.000,-52.565]}},{"noteOn":{"time":162.625,"xyz":[3.779,0.000,39.883]}},{"noteOn":{"time":162.683,"xyz":[-21.901,0.000,-1.763]}},{"noteOn":{"time":162.750,"xyz":[67.218,0.000,4.118]}},{"noteOn":{"time":162.808,"xyz":[-62.733,0.000,-81.468]}},{"noteOn":{"time":162.875,"xyz":[-56.285,0.000,-96.122]}},{"noteOn":{"time":162.933,"xyz":[69.670,0.000,67.974]}},{"noteOn":{"time":163.000,"xyz":[74.815,0.000,99.825]}},{"noteOn":{"time":163.058,"xyz":[81.182,0.000,34.107]}},{"noteOn":{"time":163.125,"xyz":[-59.448,0.000,-54.402]}},{"noteOn":{"time":163.183,"xyz":[23.406,0.000,43.321]}},{"noteOn":{"time":163.250,"xyz":[-85.830,0.000,73.268]}},{"noteOn":{"time":163.308,"xyz":[88.475,0.000,22.919]}},{"noteOn":{"time":163.375,"xyz":[20.808,0.000,82.511]}},{"noteOn":{"time":163.433,"xyz":[45.837,0.000,-22.118]}},{"noteOn":{"time":163.500,"xyz":[-90.688,0.000,81.025]}},{"noteOn":{"time":163.558,"xyz":[53.423,0.000,60.095]}},{"noteOn":{"time":163.625,"xyz":[61.376,0.000,-21.386]}},{"noteOn":{"time":163.683,"xyz":[10.940,0.000,1.825]}},{"noteOn":{"time":163.750,"xyz":[-74.345,0.000,46.925]}},{"noteOn":{"time":163.808,"xyz":[-5.663,0.000,71.317]}},{"noteOn":{"time":163.875,"xyz":[-61.023,0.000,33.580]}},{"noteOn":{"time":163.933,"xyz":[-19.803,0.000,99.212]}},{"noteOn":{"time":164.000,"xyz":[44.546,0.000,-24.100]}},{"noteOn":{"time":164.058,"xyz":[99.496,0.000,32.519]}},{"noteOn":{"time":164.125,"xyz":[0.898,0.000,8.037]}},{"noteOn":{"time":164.183,"xyz":[14.250,0.000,10.527]}},{"noteOn":{"time":164.250,"xyz":[57.540,0.000,8.662]}},{"noteOn":{"time":164.308,"xyz":[-49.379,0.000,-63.035]}},{"noteOn":{"time":164.375,"xyz":[-83.603,0.000,-93.141]}},{"noteOn":{"time":164.433,"xyz":[10.537,0.000,57.271]}},{"noteOn":{"time":164.500,"xyz":[64.781,0.000,-35.927]}},{"noteOn":{"time":164.558,"xyz":[83.266,0.000,-48.419]}},{"noteOn":{"time":164.625,"xyz":[18.145,0.000,-7.663]}},{"noteOn":{"time":164.683,"xyz":[-48.721,0.000,-64.489]}},{"noteOn":{"time":164.750,"xyz":[-88.153,0.000,-33.914]}},{"noteOn":{"time":164.808,"xyz":[93.489,0.000,-65.573]}},{"noteOn":{"time":164.875,"xyz":[93.081,0.000,49.106]}},{"noteOn":{"time":164.933,"xyz":[-3.809,0.000,-24.768]}},{"noteOn":{"time":165.000,"xyz":[49.462,0.000,2.131]}},{"noteOn":{"time":165.058,"xyz":[-49.798,0.000,-64.829]}},{"noteOn":{"time":165.125,"xyz":[32.065,0.000,72.712]}},{"noteOn":{"time":165.183,"xyz":[-95.706,0.000,12.406]}},{"noteOn":{"time":165.250,"xyz":[50.424,0.000,-90.176]}},{"noteOn":{"time":165.308,"xyz":[22.542,0.000,-49.554]}},{"noteOn":{"time":165.375,"xyz":[-2.322,0.000,3.675]}},{"noteOn":{"time":165.433,"xyz":[-80.791,0.000,70.613]}},{"noteOn":{"time":165.500,"xyz":[68.135,0.000,-61.136]}},{"noteOn":{"time":165.558,"xyz":[-18.326,0.000,55.974]}},{"noteOn":{"time":165.625,"xyz":[19.579,0.000,-21.052]}},{"noteOn":{"time":165.683,"xyz":[-97.702,0.000,99.119]}},{"noteOn":{"time":165.750,"xyz":[-28.884,0.000,85.010]}},{"noteOn":{"time":165.808,"xyz":[-13.631,0.000,87.305]}},{"noteOn":{"time":165.875,"xyz":[-23.234,0.000,22.622]}},{"noteOn":{"time":165.933,"xyz":[-51.969,0.000,64.268]}},{"noteOn":{"time":166.000,"xyz":[-62.135,0.000,42.994]}},{"noteOn":{"time":166.058,"xyz":[11.751,0.000,91.083]}},{"noteOn":{"time":166.125,"xyz":[-23.874,0.000,-52.226]}},{"noteOn":{"time":166.183,"xyz":[-34.040,0.000,-58.930]}},{"noteOn":{"time":166.250,"xyz":[-53.558,0.000,75.263]}},{"noteOn":{"time":166.308,"xyz":[30.590,0.000,18.683]}},{"noteOn":{"time":166.375,"xyz":[-13.345,0.000,91.316]}},{"noteOn":{"time":166.433,"xyz":[-36.341,0.000,1.865]}},{"noteOn":{"time":166.500,"xyz":[43.163,0.000,-56.590]}},{"noteOn":{"time":166.558,"xyz":[6.495,0.000,-15.892]}},{"noteOn":{"time":166.625,"xyz":[38.711,0.000,-46.273]}},{"noteOn":{"time":166.683,"xyz":[15.031,0.000,48.923]}},{"noteOn":{"time":166.750,"xyz":[-75.240,0.000,99.178]}},{"noteOn":{"time":166.808,"xyz":[-91.591,0.000,58.021]}},{"noteOn":{"time":166.875,"xyz":[-52.319,0.000,65.549]}},{"noteOn":{"time":166.933,"xyz":[-51.674,0.000,87.874]}},{"noteOn":{"time":167.000,"xyz":[18.404,0.000,-18.093]}},{"noteOn":{"time":167.058,"xyz":[5.760,0.000,19.784]}},{"noteOn":{"time":167.125,"xyz":[-28.553,0.000,52.507]}},{"noteOn":{"time":167.183,"xyz":[38.271,0.000,-11.175]}},{"noteOn":{"time":167.250,"xyz":[93.944,0.000,-80.694]}},{"noteOn":{"time":167.308,"xyz":[-46.345,0.000,-60.623]}},{"noteOn":{"time":167.375,"xyz":[61.001,0.000,-78.855]}},{"noteOn":{"time":167.433,"xyz":[36.670,0.000,-67.948]}},{"noteOn":{"time":167.500,"xyz":[92.754,0.000,-21.585]}},{"noteOn":{"time":167.558,"xyz":[27.488,0.000,-88.920]}},{"noteOn":{"time":167.625,"xyz":[13.610,0.000,36.839]}},{"noteOn":{"time":167.683,"xyz":[-74.135,0.000,85.138]}},{"noteOn":{"time":167.750,"xyz":[-92.446,0.000,-36.360]}},{"noteOn":{"time":167.808,"xyz":[-83.667,0.000,-89.217]}},{"noteOn":{"time":167.875,"xyz":[87.891,0.000,-83.931]}},{"noteOn":{"time":167.933,"xyz":[29.408,0.000,8.425]}},{"noteOn":{"time":168.000,"xyz":[97.585,0.000,8.736]}},{"noteOn":{"time":168.058,"xyz":[-65.493,0.000,-1.191]}},{"noteOn":{"time":168.125,"xyz":[90.179,0.000,4.829]}},{"noteOn":{"time":168.183,"xyz":[-35.650,0.000,-64.327]}},{"noteOn":{"time":168.250,"xyz":[-26.493,0.000,59.601]}},{"noteOn":{"time":168.308,"xyz":[-39.332,0.000,-59.888]}},{"noteOn":{"time":168.375,"xyz":[-8.452,0.000,65.035]}},{"noteOn":{"time":168.433,"xyz":[-30.498,0.000,-73.226]}},{"noteOn":{"time":168.500,"xyz":[-63.599,0.000,-5.222]}},{"noteOn":{"time":168.558,"xyz":[63.827,0.000,-36.260]}},{"noteOn":{"time":168.625,"xyz":[-15.114,0.000,40.827]}},{"noteOn":{"time":168.683,"xyz":[-5.963,0.000,-60.574]}},{"noteOn":{"time":168.750,"xyz":[5.249,0.000,-19.482]}},{"noteOn":{"time":168.808,"xyz":[25.653,0.000,33.430]}},{"noteOn":{"time":168.875,"xyz":[-58.624,0.000,-73.381]}},{"noteOn":{"time":168.933,"xyz":[-19.164,0.000,-83.383]}},{"noteOn":{"time":169.000,"xyz":[-82.739,0.000,-92.709]}},{"noteOn":{"time":169.058,"xyz":[18.437,0.000,51.203]}},{"noteOn":{"time":169.125,"xyz":[75.764,0.000,8.787]}},{"noteOn":{"time":169.183,"xyz":[28.926,0.000,36.811]}},{"noteOn":{"time":169.250,"xyz":[35.431,0.000,4.617]}},{"noteOn":{"time":169.308,"xyz":[-51.903,0.000,65.857]}},{"noteOn":{"time":169.375,"xyz":[79.795,0.000,-97.134]}},{"noteOn":{"time":169.433,"xyz":[-30.612,0.000,-76.303]}},{"noteOn":{"time":169.500,"xyz":[-52.303,0.000,-18.903]}},{"noteOn":{"time":169.558,"xyz":[21.601,0.000,8.201]}},{"noteOn":{"time":169.625,"xyz":[33.189,0.000,58.122]}},{"noteOn":{"time":169.683,"xyz":[-60.864,0.000,62.395]}},{"noteOn":{"time":169.750,"xyz":[92.073,0.000,86.503]}},{"noteOn":{"time":169.808,"xyz":[-51.830,0.000,-75.068]}},{"noteOn":{"time":169.875,"xyz":[51.528,0.000,51.397]}},{"noteOn":{"time":169.933,"xyz":[-13.101,0.000,-81.035]}},{"noteOn":{"time":170.000,"xyz":[-7.861,0.000,-57.172]}},{"noteOn":{"time":170.058,"xyz":[33.657,0.000,-66.983]}},{"noteOn":{"time":170.125,"xyz":[80.433,0.000,42.067]}},{"noteOn":{"time":170.183,"xyz":[-4.177,0.000,-89.869]}},{"noteOn":{"time":170.250,"xyz":[-62.755,0.000,41.144]}},{"noteOn":{"time":170.308,"xyz":[77.451,0.000,-33.538]}},{"noteOn":{"time":170.375,"xyz":[95.405,0.000,10.024]}},{"noteOn":{"time":170.433,"xyz":[57.043,0.000,20.061]}},{"noteOn":{"time":170.500,"xyz":[-8.165,0.000,51.161]}},{"noteOn":{"time":170.558,"xyz":[31.311,0.000,37.329]}},{"noteOn":{"time":170.625,"xyz":[16.706,0.000,48.535]}},{"noteOn":{"time":170.683,"xyz":[78.603,0.000,-88.903]}},{"noteOn":{"time":170.750,"xyz":[68.231,0.000,-59.644]}},{"noteOn":{"time":170.808,"xyz":[29.475,0.000,-17.106]}},{"noteOn":{"time":170.875,"xyz":[98.654,0.000,33.855]}},{"noteOn":{"time":170.933,"xyz":[64.107,0.000,25.304]}},{"noteOn":{"time":171.000,"xyz":[47.276,0.000,-50.452]}},{"noteOn":{"time":171.058,"xyz":[49.439,0.000,-79.189]}},{"noteOn":{"time":171.125,"xyz":[2.706,0.000,43.481]}},{"noteOn":{"time":171.183,"xyz":[-54.527,0.000,23.722]}},{"noteOn":{"time":171.250,"xyz":[-18.795,0.000,-78.211]}},{"noteOn":{"time":171.308,"xyz":[-87.222,0.000,84.161]}},{"noteOn":{"time":171.375,"xyz":[13.704,0.000,-55.094]}},{"noteOn":{"time":171.433,"xyz":[-95.845,0.000,-39.827]}},{"noteOn":{"time":171.500,"xyz":[63.114,0.000,-68.544]}},{"noteOn":{"time":171.558,"xyz":[-14.625,0.000,-41.750]}},{"noteOn":{"time":171.625,"xyz":[-91.336,0.000,26.759]}},{"noteOn":{"time":171.683,"xyz":[-34.769,0.000,36.530]}},{"noteOn":{"time":171.750,"xyz":[97.403,0.000,10.410]}},{"noteOn":{"time":171.808,"xyz":[-13.554,0.000,91.053]}},{"noteOn":{"time":171.875,"xyz":[37.475,0.000,-5.794]}},{"noteOn":{"time":171.933,"xyz":[98.703,0.000,36.292]}},{"noteOn":{"time":172.000,"xyz":[55.584,0.000,18.098]}},{"noteOn":{"time":172.058,"xyz":[-34.281,0.000,-0.848]}},{"noteOn":{"time":172.125,"xyz":[24.891,0.000,-99.521]}},{"noteOn":{"time":172.183,"xyz":[-87.596,0.000,-16.634]}},{"noteOn":{"time":172.250,"xyz":[-48.207,0.000,-47.516]}},{"noteOn":{"time":172.308,"xyz":[-41.837,0.000,41.069]}},{"noteOn":{"time":172.375,"xyz":[-46.818,0.000,36.414]}},{"noteOn":{"time":172.433,"xyz":[70.889,0.000,22.913]}},{"noteOn":{"time":172.500,"xyz":[-77.571,0.000,48.666]}},{"noteOn":{"time":172.558,"xyz":[75.623,0.000,-20.151]}},{"noteOn":{"time":172.625,"xyz":[-65.172,0.000,49.872]}},{"noteOn":{"time":172.683,"xyz":[24.664,0.000,-28.863]}},{"noteOn":{"time":172.750,"xyz":[44.248,0.000,62.066]}},{"noteOn":{"time":172.808,"xyz":[44.752,0.000,6.779]}},{"noteOn":{"time":172.875,"xyz":[34.627,0.000,16.920]}},{"noteOn":{"time":172.933,"xyz":[84.150,0.000,30.903]}},{"noteOn":{"time":173.000,"xyz":[75.322,0.000,-16.931]}},{"noteOn":{"time":173.058,"xyz":[50.597,0.000,48.114]}},{"noteOn":{"time":173.125,"xyz":[-49.412,0.000,36.642]}},{"noteOn":{"time":173.183,"xyz":[-77.249,0.000,20.042]}},{"noteOn":{"time":173.250,"xyz":[-46.783,0.000,79.977]}},{"noteOn":{"time":173.308,"xyz":[-4.769,0.000,26.685]}},{"noteOn":{"time":173.375,"xyz":[-87.004,0.000,-28.540]}},{"noteOn":{"time":173.433,"xyz":[43.388,0.000,-90.771]}},{"noteOn":{"time":173.500,"xyz":[-65.218,0.000,17.165]}},{"noteOn":{"time":173.558,"xyz":[-69.200,0.000,0.266]}},{"noteOn":{"time":173.625,"xyz":[-88.995,0.000,4.833]}},{"noteOn":{"time":173.683,"xyz":[-7.104,0.000,-83.692]}},{"noteOn":{"time":173.750,"xyz":[-88.101,0.000,45.297]}},{"noteOn":{"time":173.808,"xyz":[76.351,0.000,-51.424]}},{"noteOn":{"time":173.875,"xyz":[6.158,0.000,-61.777]}},{"noteOn":{"time":173.933,"xyz":[-41.357,0.000,53.936]}},{"noteOn":{"time":174.000,"xyz":[87.603,0.000,-89.503]}},{"noteOn":{"time":174.058,"xyz":[77.837,0.000,30.782]}},{"noteOn":{"time":174.125,"xyz":[-57.817,0.000,-0.817]}},{"noteOn":{"time":174.183,"xyz":[31.745,0.000,77.423]}},{"noteOn":{"time":174.250,"xyz":[46.912,0.000,-20.660]}},{"noteOn":{"time":174.308,"xyz":[20.648,0.000,-14.609]}},{"noteOn":{"time":174.375,"xyz":[-89.538,0.000,-17.538]}},{"noteOn":{"time":174.433,"xyz":[71.269,0.000,29.640]}},{"noteOn":{"time":174.500,"xyz":[-93.228,0.000,-73.473]}},{"noteOn":{"time":174.558,"xyz":[-45.937,0.000,-5.598]}},{"noteOn":{"time":174.625,"xyz":[-19.461,0.000,-4.014]}},{"noteOn":{"time":174.683,"xyz":[-46.224,0.000,29.875]}},{"noteOn":{"time":174.750,"xyz":[79.467,0.000,-17.854]}},{"noteOn":{"time":174.808,"xyz":[-63.011,0.000,-16.422]}},{"noteOn":{"time":174.875,"xyz":[-44.968,0.000,-66.399]}},{"noteOn":{"time":174.933,"xyz":[42.600,0.000,3.507]}},{"noteOn":{"time":175.000,"xyz":[33.891,0.000,-14.633]}},{"noteOn":{"time":175.058,"xyz":[64.368,0.000,-19.256]}},{"noteOn":{"time":175.125,"xyz":[58.352,0.000,46.449]}},{"noteOn":{"time":175.183,"xyz":[-38.777,0.000,99.379]}},{"noteOn":{"time":175.250,"xyz":[89.039,0.000,-58.539]}},{"noteOn":{"time":175.308,"xyz":[-16.383,0.000,3.952]}},{"noteOn":{"time":175.375,"xyz":[-81.435,0.000,34.847]}},{"noteOn":{"time":175.433,"xyz":[5.128,0.000,-8.262]}},{"noteOn":{"time":175.500,"xyz":[-75.898,0.000,29.018]}},{"noteOn":{"time":175.558,"xyz":[60.485,0.000,1.412]}},{"noteOn":{"time":175.625,"xyz":[-48.189,0.000,-67.445]}},{"noteOn":{"time":175.683,"xyz":[-23.499,0.000,-86.382]}},{"noteOn":{"time":175.750,"xyz":[-60.461,0.000,54.226]}},{"noteOn":{"time":175.808,"xyz":[3.701,0.000,15.055]}},{"noteOn":{"time":175.875,"xyz":[-91.373,0.000,-94.702]}},{"noteOn":{"time":175.933,"xyz":[76.168,0.000,-81.447]}},{"noteOn":{"time":176.000,"xyz":[53.503,0.000,-0.896]}},{"noteOn":{"time":176.058,"xyz":[7.781,0.000,-10.399]}},{"noteOn":{"time":176.125,"xyz":[-8.440,0.000,-64.580]}},{"noteOn":{"time":176.183,"xyz":[-62.878,0.000,-82.526]}},{"noteOn":{"time":176.250,"xyz":[-32.013,0.000,-39.447]}},{"noteOn":{"time":176.308,"xyz":[-76.620,0.000,99.015]}},{"noteOn":{"time":176.375,"xyz":[3.450,0.000,14.550]}},{"noteOn":{"time":176.433,"xyz":[-65.964,0.000,87.680]}},{"noteOn":{"time":176.500,"xyz":[-10.924,0.000,27.102]}},{"noteOn":{"time":176.558,"xyz":[14.554,0.000,-87.788]}},{"noteOn":{"time":176.625,"xyz":[35.745,0.000,-83.850]}},{"noteOn":{"time":176.683,"xyz":[-46.878,0.000,-99.238]}},{"noteOn":{"time":176.750,"xyz":[-64.320,0.000,90.220]}},{"noteOn":{"time":176.808,"xyz":[-87.688,0.000,-30.093]}},{"noteOn":{"time":176.875,"xyz":[56.232,0.000,69.813]}},{"noteOn":{"time":176.933,"xyz":[56.718,0.000,66.333]}},{"noteOn":{"time":177.000,"xyz":[-78.894,0.000,37.082]}},{"noteOn":{"time":177.058,"xyz":[23.832,0.000,-5.542]}},{"noteOn":{"time":177.125,"xyz":[5.562,0.000,-90.794]}},{"noteOn":{"time":177.183,"xyz":[-73.020,0.000,-61.533]}},{"noteOn":{"time":177.250,"xyz":[41.870,0.000,21.647]}},{"noteOn":{"time":177.308,"xyz":[-93.281,0.000,4.610]}},{"noteOn":{"time":177.375,"xyz":[61.929,0.000,-84.487]}},{"noteOn":{"time":177.433,"xyz":[23.042,0.000,-18.301]}},{"noteOn":{"time":177.500,"xyz":[58.101,0.000,-39.063]}},{"noteOn":{"time":177.558,"xyz":[-32.330,0.000,56.975]}},{"noteOn":{"time":177.625,"xyz":[-16.698,0.000,28.260]}},{"noteOn":{"time":177.683,"xyz":[36.041,0.000,-56.524]}},{"noteOn":{"time":177.750,"xyz":[-0.071,0.000,53.383]}},{"noteOn":{"time":177.808,"xyz":[94.935,0.000,-13.832]}},{"noteOn":{"time":177.875,"xyz":[86.555,0.000,-54.594]}},{"noteOn":{"time":177.933,"xyz":[76.351,0.000,29.924]}},{"noteOn":{"time":178.000,"xyz":[84.218,0.000,-33.881]}},{"noteOn":{"time":178.058,"xyz":[83.942,0.000,-34.570]}},{"noteOn":{"time":178.125,"xyz":[72.901,0.000,84.554]}},{"noteOn":{"time":178.183,"xyz":[77.437,0.000,31.813]}},{"noteOn":{"time":178.250,"xyz":[-23.971,0.000,-11.907]}},{"noteOn":{"time":178.308,"xyz":[-34.546,0.000,-40.351]}},{"noteOn":{"time":178.375,"xyz":[-41.023,0.000,27.185]}},{"noteOn":{"time":178.433,"xyz":[-49.329,0.000,-2.406]}},{"noteOn":{"time":178.500,"xyz":[79.183,0.000,95.875]}},{"noteOn":{"time":178.558,"xyz":[-4.353,0.000,-7.369]}},{"noteOn":{"time":178.625,"xyz":[22.982,0.000,-82.240]}},{"noteOn":{"time":178.683,"xyz":[75.510,0.000,-99.625]}},{"noteOn":{"time":178.750,"xyz":[-9.696,0.000,-70.961]}},{"noteOn":{"time":178.808,"xyz":[-82.526,0.000,0.505]}},{"noteOn":{"time":178.875,"xyz":[-74.785,0.000,-60.408]}},{"noteOn":{"time":178.933,"xyz":[-40.610,0.000,-4.276]}},{"noteOn":{"time":179.000,"xyz":[-99.290,0.000,-78.021]}},{"noteOn":{"time":179.058,"xyz":[-47.304,0.000,93.138]}},{"noteOn":{"time":179.125,"xyz":[12.409,0.000,39.341]}},{"noteOn":{"time":179.183,"xyz":[-48.266,0.000,17.164]}},{"noteOn":{"time":179.250,"xyz":[-19.468,0.000,89.064]}},{"noteOn":{"time":179.308,"xyz":[33.946,0.000,95.430]}},{"noteOn":{"time":179.375,"xyz":[65.233,0.000,-77.975]}},{"noteOn":{"time":179.433,"xyz":[-53.576,0.000,6.237]}},{"noteOn":{"time":179.500,"xyz":[29.430,0.000,9.967]}},{"noteOn":{"time":179.558,"xyz":[36.215,0.000,90.369]}},{"noteOn":{"time":179.625,"xyz":[-1.675,0.000,-11.592]}},{"noteOn":{"time":179.683,"xyz":[57.135,0.000,24.020]}},{"noteOn":{"time":179.750,"xyz":[-71.702,0.000,12.081]}},{"noteOn":{"time":179.808,"xyz":[17.120,0.000,-64.281]}},{"noteOn":{"time":179.875,"xyz":[72.244,0.000,-63.353]}},{"noteOn":{"time":179.933,"xyz":[99.889,0.000,40.953]}},{"noteOn":{"time":180.000,"xyz":[76.305,0.000,-3.129]}},{"noteOn":{"time":180.058,"xyz":[-74.659,0.000,-23.788]}},{"noteOn":{"time":180.125,"xyz":[26.708,0.000,0.078]}},{"noteOn":{"time":180.183,"xyz":[-32.785,0.000,-48.137]}},{"noteOn":{"time":180.250,"xyz":[47.673,0.000,7.051]}},{"noteOn":{"time":180.308,"xyz":[86.593,0.000,23.130]}},{"noteOn":{"time":180.375,"xyz":[-5.500,0.000,42.998]}},{"noteOn":{"time":180.433,"xyz":[28.278,0.000,-86.931]}},{"noteOn":{"time":180.500,"xyz":[-47.446,0.000,81.455]}},{"noteOn":{"time":180.558,"xyz":[26.517,0.000,-76.865]}},{"noteOn":{"time":180.625,"xyz":[-94.591,0.000,-13.659]}},{"noteOn":{"time":180.683,"xyz":[-60.628,0.000,48.417]}},{"noteOn":{"time":180.750,"xyz":[36.381,0.000,-5.526]}},{"noteOn":{"time":180.808,"xyz":[39.854,0.000,88.241]}},{"noteOn":{"time":180.875,"xyz":[-60.409,0.000,85.103]}},{"noteOn":{"time":180.933,"xyz":[99.127,0.000,21.148]}},{"noteOn":{"time":181.000,"xyz":[-97.925,0.000,-73.052]}},{"noteOn":{"time":181.058,"xyz":[-34.710,0.000,8.790]}},{"noteOn":{"time":181.125,"xyz":[39.708,0.000,29.409]}},{"noteOn":{"time":181.183,"xyz":[32.824,0.000,18.453]}},{"noteOn":{"time":181.250,"xyz":[-10.527,0.000,-34.632]}},{"noteOn":{"time":181.308,"xyz":[75.333,0.000,21.311]}},{"noteOn":{"time":181.375,"xyz":[-58.756,0.000,91.079]}},{"noteOn":{"time":181.433,"xyz":[40.189,0.000,-54.399]}},{"noteOn":{"time":181.500,"xyz":[-3.634,0.000,-23.721]}},{"noteOn":{"time":181.558,"xyz":[40.609,0.000,53.132]}},{"noteOn":{"time":181.625,"xyz":[30.352,0.000,-12.418]}},{"noteOn":{"time":181.683,"xyz":[91.029,0.000,76.516]}},{"noteOn":{"time":181.750,"xyz":[-24.500,0.000,52.755]}},{"noteOn":{"time":181.808,"xyz":[-22.054,0.000,-84.363]}},{"noteOn":{"time":181.875,"xyz":[-11.383,0.000,-14.751]}},{"noteOn":{"time":181.933,"xyz":[3.108,0.000,57.670]}},{"noteOn":{"time":182.000,"xyz":[91.946,0.000,-20.189]}},{"noteOn":{"time":182.058,"xyz":[41.620,0.000,-31.982]}},{"noteOn":{"time":182.125,"xyz":[34.109,0.000,13.608]}},{"noteOn":{"time":182.183,"xyz":[-13.392,0.000,12.168]}},{"noteOn":{"time":182.250,"xyz":[75.181,0.000,15.646]}},{"noteOn":{"time":182.308,"xyz":[67.143,0.000,23.416]}},{"noteOn":{"time":182.375,"xyz":[18.098,0.000,12.747]}},{"noteOn":{"time":182.433,"xyz":[89.587,0.000,-59.085]}},{"noteOn":{"time":182.500,"xyz":[50.279,0.000,-64.426]}},{"noteOn":{"time":182.558,"xyz":[26.963,0.000,19.323]}},{"noteOn":{"time":182.625,"xyz":[86.811,0.000,-14.462]}},{"noteOn":{"time":182.683,"xyz":[-71.234,0.000,67.715]}},{"noteOn":{"time":182.750,"xyz":[82.578,0.000,-64.473]}},{"noteOn":{"time":182.808,"xyz":[-92.546,0.000,24.104]}},{"noteOn":{"time":182.875,"xyz":[67.599,0.000,76.632]}},{"noteOn":{"time":182.933,"xyz":[-59.936,0.000,25.198]}},{"noteOn":{"time":183.000,"xyz":[20.194,0.000,42.003]}},{"noteOn":{"time":183.058,"xyz":[66.571,0.000,1.547]}},{"noteOn":{"time":183.125,"xyz":[-11.100,0.000,50.087]}},{"noteOn":{"time":183.183,"xyz":[33.215,0.000,28.442]}},{"noteOn":{"time":183.250,"xyz":[68.768,0.000,-74.661]}},{"noteOn":{"time":183.308,"xyz":[-18.461,0.000,5.274]}},{"noteOn":{"time":183.375,"xyz":[-6.644,0.000,-12.507]}},{"noteOn":{"time":183.433,"xyz":[-15.120,0.000,33.164]}},{"noteOn":{"time":183.500,"xyz":[-17.191,0.000,63.170]}},{"noteOn":{"time":183.558,"xyz":[-54.036,0.000,-75.074]}},{"noteOn":{"time":183.625,"xyz":[-46.520,0.000,78.495]}},{"noteOn":{"time":183.683,"xyz":[-45.406,0.000,-74.646]}},{"noteOn":{"time":183.750,"xyz":[8.015,0.000,50.967]}},{"noteOn":{"time":183.808,"xyz":[-74.272,0.000,-44.025]}},{"noteOn":{"time":183.875,"xyz":[-50.774,0.000,25.560]}},{"noteOn":{"time":183.933,"xyz":[-42.047,0.000,39.231]}},{"noteOn":{"time":184.000,"xyz":[-41.051,0.000,-93.484]}},{"noteOn":{"time":184.058,"xyz":[33.048,0.000,15.040]}},{"noteOn":{"time":184.125,"xyz":[16.858,0.000,34.886]}},{"noteOn":{"time":184.183,"xyz":[-18.607,0.000,-49.599]}},{"noteOn":{"time":184.250,"xyz":[66.437,0.000,65.220]}},{"noteOn":{"time":184.308,"xyz":[-71.925,0.000,-27.406]}},{"noteOn":{"time":184.375,"xyz":[28.479,0.000,15.313]}},{"noteOn":{"time":184.433,"xyz":[72.951,0.000,-58.930]}},{"noteOn":{"time":184.500,"xyz":[79.072,0.000,13.091]}},{"noteOn":{"time":184.558,"xyz":[-92.590,0.000,24.921]}},{"noteOn":{"time":184.625,"xyz":[11.595,0.000,57.125]}},{"noteOn":{"time":184.683,"xyz":[-6.625,0.000,-15.780]}},{"noteOn":{"time":184.750,"xyz":[-46.813,0.000,-45.680]}},{"noteOn":{"time":184.808,"xyz":[88.903,0.000,-22.788]}},{"noteOn":{"time":184.875,"xyz":[68.101,0.000,-87.406]}},{"noteOn":{"time":184.933,"xyz":[61.961,0.000,-56.409]}},{"noteOn":{"time":185.000,"xyz":[-84.311,0.000,-39.716]}},{"noteOn":{"time":185.058,"xyz":[-47.881,0.000,59.665]}},{"noteOn":{"time":185.125,"xyz":[-97.950,0.000,50.180]}},{"noteOn":{"time":185.183,"xyz":[81.495,0.000,-63.634]}},{"noteOn":{"time":185.250,"xyz":[-65.885,0.000,96.883]}},{"noteOn":{"time":185.308,"xyz":[-56.153,0.000,-51.532]}},{"noteOn":{"time":185.375,"xyz":[15.588,0.000,-95.787]}},{"noteOn":{"time":185.433,"xyz":[76.663,0.000,55.426]}},{"noteOn":{"time":185.500,"xyz":[78.286,0.000,77.059]}},{"noteOn":{"time":185.558,"xyz":[-91.984,0.000,-86.459]}},{"noteOn":{"time":185.625,"xyz":[82.430,0.000,-8.020]}},{"noteOn":{"time":185.683,"xyz":[30.324,0.000,98.047]}},{"noteOn":{"time":185.750,"xyz":[-92.053,0.000,35.403]}},{"noteOn":{"time":185.808,"xyz":[-50.594,0.000,64.912]}},{"noteOn":{"time":185.875,"xyz":[58.243,0.000,20.057]}},{"noteOn":{"time":185.933,"xyz":[52.000,0.000,-2.083]}},{"noteOn":{"time":186.000,"xyz":[70.747,0.000,71.689]}},{"noteOn":{"time":186.058,"xyz":[-9.482,0.000,-80.401]}},{"noteOn":{"time":186.125,"xyz":[37.332,0.000,-48.224]}},{"noteOn":{"time":186.183,"xyz":[62.971,0.000,-92.644]}},{"noteOn":{"time":186.250,"xyz":[-55.046,0.000,60.241]}},{"noteOn":{"time":186.308,"xyz":[-69.013,0.000,-39.128]}},{"noteOn":{"time":186.375,"xyz":[-85.027,0.000,57.704]}},{"noteOn":{"time":186.433,"xyz":[-67.649,0.000,-73.405]}},{"noteOn":{"time":186.500,"xyz":[11.272,0.000,71.990]}},{"noteOn":{"time":186.558,"xyz":[-31.091,0.000,-88.220]}},{"noteOn":{"time":186.625,"xyz":[-35.203,0.000,20.998]}},{"noteOn":{"time":186.683,"xyz":[48.506,0.000,-72.989]}},{"noteOn":{"time":186.750,"xyz":[88.125,0.000,6.103]}},{"noteOn":{"time":186.808,"xyz":[93.453,0.000,94.805]}},{"noteOn":{"time":186.875,"xyz":[90.584,0.000,19.527]}},{"noteOn":{"time":186.933,"xyz":[-39.794,0.000,-34.830]}},{"noteOn":{"time":187.000,"xyz":[14.804,0.000,78.056]}},{"noteOn":{"time":187.058,"xyz":[8.141,0.000,99.526]}},{"noteOn":{"time":187.125,"xyz":[-38.151,0.000,-43.384]}},{"noteOn":{"time":187.183,"xyz":[-28.122,0.000,34.583]}},{"noteOn":{"time":187.250,"xyz":[16.836,0.000,61.029]}},{"noteOn":{"time":187.308,"xyz":[-5.832,0.000,30.164]}},{"noteOn":{"time":187.375,"xyz":[92.583,0.000,62.307]}},{"noteOn":{"time":187.433,"xyz":[27.331,0.000,-47.989]}},{"noteOn":{"time":187.500,"xyz":[37.949,0.000,27.494]}},{"noteOn":{"time":187.558,"xyz":[73.129,0.000,54.888]}},{"noteOn":{"time":187.625,"xyz":[-27.452,0.000,-63.002]}},{"noteOn":{"time":187.683,"xyz":[66.339,0.000,25.235]}},{"noteOn":{"time":187.750,"xyz":[-26.974,0.000,-12.124]}},{"noteOn":{"time":187.808,"xyz":[78.547,0.000,28.752]}},{"noteOn":{"time":187.875,"xyz":[10.470,0.000,-40.660]}},{"noteOn":{"time":187.933,"xyz":[88.445,0.000,-0.868]}},{"noteOn":{"time":188.000,"xyz":[-13.604,0.000,73.157]}},{"noteOn":{"time":188.058,"xyz":[95.549,0.000,12.138]}},{"noteOn":{"time":188.125,"xyz":[98.534,0.000,30.271]}},{"noteOn":{"time":188.183,"xyz":[8.369,0.000,26.955]}},{"noteOn":{"time":188.250,"xyz":[-50.134,0.000,-41.699]}},{"noteOn":{"time":188.308,"xyz":[-21.900,0.000,-43.414]}},{"noteOn":{"time":188.375,"xyz":[57.536,0.000,75.050]}},{"noteOn":{"time":188.433,"xyz":[37.391,0.000,63.677]}},{"noteOn":{"time":188.500,"xyz":[84.842,0.000,73.378]}},{"noteOn":{"time":188.558,"xyz":[-96.867,0.000,79.875]}},{"noteOn":{"time":188.625,"xyz":[72.075,0.000,-24.819]}},{"noteOn":{"time":188.683,"xyz":[-24.908,0.000,-71.712]}},{"noteOn":{"time":188.750,"xyz":[-57.067,0.000,-0.751]}},{"noteOn":{"time":188.808,"xyz":[-29.018,0.000,-97.751]}},{"noteOn":{"time":188.875,"xyz":[75.161,0.000,52.092]}},{"noteOn":{"time":188.933,"xyz":[45.808,0.000,-68.096]}},{"noteOn":{"time":189.000,"xyz":[-90.590,0.000,94.708]}},{"noteOn":{"time":189.058,"xyz":[-88.532,0.000,-34.363]}},{"noteOn":{"time":189.125,"xyz":[91.612,0.000,74.449]}},{"noteOn":{"time":189.183,"xyz":[-35.798,0.000,18.575]}},{"noteOn":{"time":189.250,"xyz":[63.880,0.000,51.933]}},{"noteOn":{"time":189.308,"xyz":[5.035,0.000,-92.240]}},{"noteOn":{"time":189.375,"xyz":[-0.390,0.000,10.969]}},{"noteOn":{"time":189.433,"xyz":[-35.700,0.000,15.668]}},{"noteOn":{"time":189.500,"xyz":[82.574,0.000,-72.855]}},{"noteOn":{"time":189.558,"xyz":[-21.710,0.000,13.007]}},{"noteOn":{"time":189.625,"xyz":[19.807,0.000,0.633]}},{"noteOn":{"time":189.683,"xyz":[-23.615,0.000,40.683]}},{"noteOn":{"time":189.750,"xyz":[-83.394,0.000,43.321]}},{"noteOn":{"time":189.808,"xyz":[83.340,0.000,11.924]}},{"noteOn":{"time":189.875,"xyz":[91.331,0.000,62.135]}},{"noteOn":{"time":189.933,"xyz":[-13.887,0.000,-38.593]}},{"noteOn":{"time":190.000,"xyz":[30.581,0.000,11.871]}},{"noteOn":{"time":190.058,"xyz":[20.285,0.000,-48.772]}},{"noteOn":{"time":190.125,"xyz":[-55.907,0.000,-85.513]}},{"noteOn":{"time":190.183,"xyz":[60.237,0.000,56.243]}},{"noteOn":{"time":190.250,"xyz":[35.935,0.000,-29.880]}},{"noteOn":{"time":190.308,"xyz":[12.261,0.000,6.195]}},{"noteOn":{"time":190.375,"xyz":[-73.250,0.000,-69.391]}},{"noteOn":{"time":190.433,"xyz":[-26.699,0.000,71.627]}},{"noteOn":{"time":190.500,"xyz":[3.372,0.000,-18.510]}},{"noteOn":{"time":190.558,"xyz":[-7.617,0.000,-42.692]}},{"noteOn":{"time":190.625,"xyz":[99.714,0.000,95.820]}},{"noteOn":{"time":190.683,"xyz":[19.690,0.000,-76.620]}},{"noteOn":{"time":190.750,"xyz":[-11.220,0.000,-4.741]}},{"noteOn":{"time":190.808,"xyz":[-88.007,0.000,-96.963]}},{"noteOn":{"time":190.875,"xyz":[-47.431,0.000,93.080]}},{"noteOn":{"time":190.933,"xyz":[45.403,0.000,-61.116]}},{"noteOn":{"time":191.000,"xyz":[-58.978,0.000,35.061]}},{"noteOn":{"time":191.058,"xyz":[-42.999,0.000,12.755]}},{"noteOn":{"time":191.125,"xyz":[29.555,0.000,30.629]}},{"noteOn":{"time":191.183,"xyz":[11.993,0.000,47.105]}},{"noteOn":{"time":191.250,"xyz":[-44.721,0.000,86.857]}},{"noteOn":{"time":191.308,"xyz":[-16.067,0.000,-13.048]}},{"noteOn":{"time":191.375,"xyz":[-63.875,0.000,41.015]}},{"noteOn":{"time":191.433,"xyz":[-62.181,0.000,-43.124]}},{"noteOn":{"time":191.500,"xyz":[89.607,0.000,-83.221]}},{"noteOn":{"time":191.558,"xyz":[-76.041,0.000,91.946]}},{"noteOn":{"time":191.625,"xyz":[2.563,0.000,27.520]}},{"noteOn":{"time":191.683,"xyz":[30.614,0.000,92.270]}},{"noteOn":{"time":191.750,"xyz":[-70.012,0.000,-7.723]}},{"noteOn":{"time":191.808,"xyz":[98.562,0.000,-8.193]}},{"noteOn":{"time":191.875,"xyz":[-48.889,0.000,80.060]}},{"noteOn":{"time":191.933,"xyz":[50.706,0.000,82.061]}},{"noteOn":{"time":192.000,"xyz":[60.804,0.000,-51.905]}},{"noteOn":{"time":192.058,"xyz":[39.831,0.000,-18.718]}},{"noteOn":{"time":192.125,"xyz":[24.482,0.000,89.637]}},{"noteOn":{"time":192.183,"xyz":[67.667,0.000,89.801]}},{"noteOn":{"time":192.250,"xyz":[74.601,0.000,-43.019]}},{"noteOn":{"time":192.308,"xyz":[-21.646,0.000,-77.879]}},{"noteOn":{"time":192.375,"xyz":[-23.124,0.000,-24.707]}},{"noteOn":{"time":192.433,"xyz":[-20.549,0.000,56.397]}},{"noteOn":{"time":192.500,"xyz":[44.360,0.000,-87.115]}},{"noteOn":{"time":192.558,"xyz":[93.609,0.000,91.910]}},{"noteOn":{"time":192.625,"xyz":[-72.505,0.000,-76.437]}},{"noteOn":{"time":192.683,"xyz":[-5.969,0.000,55.191]}},{"noteOn":{"time":192.750,"xyz":[58.260,0.000,26.664]}},{"noteOn":{"time":192.808,"xyz":[-73.148,0.000,-54.608]}},{"noteOn":{"time":192.875,"xyz":[76.558,0.000,40.426]}},{"noteOn":{"time":192.933,"xyz":[73.546,0.000,-40.462]}},{"noteOn":{"time":193.000,"xyz":[16.941,0.000,34.286]}},{"noteOn":{"time":193.058,"xyz":[-43.489,0.000,-11.701]}},{"noteOn":{"time":193.125,"xyz":[83.820,0.000,15.762]}},{"noteOn":{"time":193.183,"xyz":[-59.065,0.000,22.881]}},{"noteOn":{"time":193.250,"xyz":[93.274,0.000,17.529]}},{"noteOn":{"time":193.308,"xyz":[-63.925,0.000,-36.317]}},{"noteOn":{"time":193.375,"xyz":[-90.416,0.000,0.303]}},{"noteOn":{"time":193.433,"xyz":[49.082,0.000,-28.666]}},{"noteOn":{"time":193.500,"xyz":[54.623,0.000,37.189]}},{"noteOn":{"time":193.558,"xyz":[-5.517,0.000,-49.262]}},{"noteOn":{"time":193.625,"xyz":[-81.782,0.000,95.084]}},{"noteOn":{"time":193.683,"xyz":[-87.543,0.000,8.755]}},{"noteOn":{"time":193.750,"xyz":[47.614,0.000,-21.217]}},{"noteOn":{"time":193.808,"xyz":[99.019,0.000,-23.868]}},{"noteOn":{"time":193.875,"xyz":[44.170,0.000,53.401]}},{"noteOn":{"time":193.933,"xyz":[1.253,0.000,-65.671]}},{"noteOn":{"time":194.000,"xyz":[45.397,0.000,10.747]}},{"noteOn":{"time":194.058,"xyz":[80.698,0.000,-62.164]}},{"noteOn":{"time":194.125,"xyz":[20.485,0.000,-4.740]}},{"noteOn":{"time":194.183,"xyz":[-1.970,0.000,-27.358]}},{"noteOn":{"time":194.250,"xyz":[-42.584,0.000,55.145]}},{"noteOn":{"time":194.308,"xyz":[22.158,0.000,41.446]}},{"noteOn":{"time":194.375,"xyz":[69.820,0.000,-65.669]}},{"noteOn":{"time":194.433,"xyz":[16.854,0.000,-83.738]}},{"noteOn":{"time":194.500,"xyz":[1.669,0.000,70.869]}},{"noteOn":{"time":194.558,"xyz":[8.053,0.000,-50.979]}},{"noteOn":{"time":194.625,"xyz":[57.959,0.000,-82.597]}},{"noteOn":{"time":194.683,"xyz":[-15.063,0.000,-19.183]}},{"noteOn":{"time":194.750,"xyz":[-60.520,0.000,-50.659]}},{"noteOn":{"time":194.808,"xyz":[37.940,0.000,40.402]}},{"noteOn":{"time":194.875,"xyz":[-90.171,0.000,-23.665]}},{"noteOn":{"time":194.933,"xyz":[-13.219,0.000,-27.430]}},{"noteOn":{"time":195.000,"xyz":[-27.241,0.000,22.720]}},{"noteOn":{"time":195.058,"xyz":[-98.327,0.000,-12.956]}},{"noteOn":{"time":195.125,"xyz":[88.016,0.000,92.510]}},{"noteOn":{"time":195.183,"xyz":[-29.186,0.000,-31.499]}},{"noteOn":{"time":195.250,"xyz":[-96.230,0.000,-15.398]}},{"noteOn":{"time":195.308,"xyz":[17.292,0.000,38.346]}},{"noteOn":{"time":195.375,"xyz":[-66.220,0.000,-26.211]}},{"noteOn":{"time":195.433,"xyz":[18.533,0.000,-91.118]}},{"noteOn":{"time":195.500,"xyz":[-42.601,0.000,23.225]}},{"noteOn":{"time":195.558,"xyz":[31.411,0.000,20.475]}},{"noteOn":{"time":195.625,"xyz":[70.571,0.000,43.961]}},{"noteOn":{"time":195.683,"xyz":[-23.854,0.000,-97.641]}},{"noteOn":{"time":195.750,"xyz":[65.915,0.000,-32.830]}},{"noteOn":{"time":195.808,"xyz":[-17.885,0.000,47.696]}},{"noteOn":{"time":195.875,"xyz":[70.045,0.000,44.700]}},{"noteOn":{"time":195.933,"xyz":[48.709,0.000,43.525]}},{"noteOn":{"time":196.000,"xyz":[16.238,0.000,43.567]}},{"noteOn":{"time":196.058,"xyz":[24.345,0.000,-53.797]}},{"noteOn":{"time":196.125,"xyz":[-19.422,0.000,50.017]}},{"noteOn":{"time":196.183,"xyz":[-43.228,0.000,-56.998]}},{"noteOn":{"time":196.250,"xyz":[59.705,0.000,48.794]}},{"noteOn":{"time":196.308,"xyz":[-82.210,0.000,-9.559]}},{"noteOn":{"time":196.375,"xyz":[-81.715,0.000,93.211]}},{"noteOn":{"time":196.433,"xyz":[55.511,0.000,-29.981]}},{"noteOn":{"time":196.500,"xyz":[-15.664,0.000,-68.315]}},{"noteOn":{"time":196.558,"xyz":[77.279,0.000,-48.060]}},{"noteOn":{"time":196.625,"xyz":[-79.469,0.000,6.325]}},{"noteOn":{"time":196.683,"xyz":[16.380,0.000,7.487]}},{"noteOn":{"time":196.750,"xyz":[49.598,0.000,-10.770]}},{"noteOn":{"time":196.808,"xyz":[-14.329,0.000,60.639]}},{"noteOn":{"time":196.875,"xyz":[61.951,0.000,72.096]}},{"noteOn":{"time":196.933,"xyz":[71.242,0.000,-80.419]}},{"noteOn":{"time":197.000,"xyz":[-16.330,0.000,74.778]}},{"noteOn":{"time":197.058,"xyz":[-30.755,0.000,78.716]}},{"noteOn":{"time":197.125,"xyz":[32.962,0.000,88.412]}},{"noteOn":{"time":197.183,"xyz":[19.013,0.000,-68.185]}},{"noteOn":{"time":197.250,"xyz":[43.213,0.000,18.742]}},{"noteOn":{"time":197.308,"xyz":[-64.409,0.000,86.917]}},{"noteOn":{"time":197.375,"xyz":[-19.218,0.000,45.261]}},{"noteOn":{"time":197.433,"xyz":[-5.194,0.000,-76.378]}},{"noteOn":{"time":197.500,"xyz":[-64.370,0.000,61.800]}},{"noteOn":{"time":197.558,"xyz":[74.001,0.000,-16.618]}},{"noteOn":{"time":197.625,"xyz":[12.942,0.000,14.188]}},{"noteOn":{"time":197.683,"xyz":[1.564,0.000,33.433]}},{"noteOn":{"time":197.750,"xyz":[3.836,0.000,-99.398]}},{"noteOn":{"time":197.808,"xyz":[-81.641,0.000,94.975]}},{"noteOn":{"time":197.875,"xyz":[-36.694,0.000,50.246]}},{"noteOn":{"time":197.933,"xyz":[4.208,0.000,-23.750]}},{"noteOn":{"time":198.000,"xyz":[73.520,0.000,-54.033]}},{"noteOn":{"time":198.058,"xyz":[-27.469,0.000,-98.889]}},{"noteOn":{"time":198.125,"xyz":[20.582,0.000,-93.552]}},{"noteOn":{"time":198.183,"xyz":[-13.725,0.000,73.733]}},{"noteOn":{"time":198.250,"xyz":[-37.087,0.000,-6.409]}},{"noteOn":{"time":198.308,"xyz":[98.259,0.000,70.083]}},{"noteOn":{"time":198.375,"xyz":[19.342,0.000,-39.277]}},{"noteOn":{"time":198.433,"xyz":[-30.943,0.000,-3.232]}},{"noteOn":{"time":198.500,"xyz":[55.056,0.000,-92.752]}},{"noteOn":{"time":198.558,"xyz":[65.547,0.000,7.893]}},{"noteOn":{"time":198.625,"xyz":[-6.468,0.000,-44.633]}},{"noteOn":{"time":198.683,"xyz":[-6.757,0.000,20.553]}},{"noteOn":{"time":198.750,"xyz":[-67.441,0.000,-85.505]}},{"noteOn":{"time":198.808,"xyz":[65.554,0.000,-80.421]}},{"noteOn":{"time":198.875,"xyz":[-7.505,0.000,-51.002]}},{"noteOn":{"time":198.933,"xyz":[63.062,0.000,-7.828]}}],"fd575f03378047af835c19ef4f7d5991":[{"instanceName":""},{"noteOn":{"time":8.000}},{"noteOn":{"time":8.000}},{"noteOn":{"time":10.000}},{"noteOn":{"time":10.000}},{"noteOn":{"time":12.000}},{"noteOn":{"time":12.000}},{"noteOn":{"time":14.000}},{"noteOn":{"time":14.000}},{"noteOn":{"time":16.000}},{"noteOn":{"time":16.000}},{"noteOn":{"time":18.000}},{"noteOn":{"time":18.000}},{"noteOn":{"time":20.000}},{"noteOn":{"time":20.000}},{"noteOn":{"time":22.000}},{"noteOn":{"time":22.000}},{"noteOn":{"time":24.000}},{"noteOn":{"time":24.000}},{"noteOn":{"time":26.000}},{"noteOn":{"time":26.000}},{"noteOn":{"time":28.000}},{"noteOn":{"time":28.000}},{"noteOn":{"time":30.000}},{"noteOn":{"time":30.000}},{"noteOn":{"time":32.000}},{"noteOn":{"time":32.000}},{"noteOn":{"time":34.000}},{"noteOn":{"time":34.000}},{"noteOn":{"time":36.000}},{"noteOn":{"time":36.000}},{"noteOn":{"time":38.000}},{"noteOn":{"time":38.000}},{"noteOn":{"time":40.000}},{"noteOn":{"time":40.000}},{"noteOn":{"time":42.000}},{"noteOn":{"time":42.000}},{"noteOn":{"time":44.000}},{"noteOn":{"time":44.000}},{"noteOn":{"time":46.000}},{"noteOn":{"time":46.000}},{"noteOn":{"time":48.000}},{"noteOn":{"time":48.000}},{"noteOn":{"time":50.000}},{"noteOn":{"time":50.000}},{"noteOn":{"time":52.000}},{"noteOn":{"time":52.000}},{"noteOn":{"time":54.000}},{"noteOn":{"time":54.000}},{"noteOn":{"time":56.000}},{"noteOn":{"time":56.000}},{"noteOn":{"time":58.000}},{"noteOn":{"time":58.000}},{"noteOn":{"time":60.000}},{"noteOn":{"time":60.000}},{"noteOn":{"time":62.000}},{"noteOn":{"time":62.000}},{"noteOn":{"time":64.000}},{"noteOn":{"time":64.000}},{"noteOn":{"time":66.000}},{"noteOn":{"time":66.000}},{"noteOn":{"time":68.000}},{"noteOn":{"time":68.000}},{"noteOn":{"time":70.000}},{"noteOn":{"time":70.000}},{"noteOn":{"time":72.000}},{"noteOn":{"time":72.000}},{"noteOn":{"time":74.000}},{"noteOn":{"time":74.000}},{"noteOn":{"time":76.000}},{"noteOn":{"time":76.000}},{"noteOn":{"time":78.000}},{"noteOn":{"time":78.000}},{"noteOn":{"time":80.000}},{"noteOn":{"time":80.000}},{"noteOn":{"time":82.000}},{"noteOn":{"time":82.000}},{"noteOn":{"time":84.000}},{"noteOn":{"time":84.000}},{"noteOn":{"time":86.000}},{"noteOn":{"time":86.000}},{"noteOn":{"time":88.000}},{"noteOn":{"time":88.000}},{"noteOn":{"time":90.000}},{"noteOn":{"time":90.000}},{"noteOn":{"time":92.000}},{"noteOn":{"time":92.000}},{"noteOn":{"time":94.000}},{"noteOn":{"time":94.000}},{"noteOn":{"time":96.000}},{"noteOn":{"time":96.000}},{"noteOn":{"time":98.000}},{"noteOn":{"time":98.000}},{"noteOn":{"time":100.000}},{"noteOn":{"time":100.000}},{"noteOn":{"time":102.000}},{"noteOn":{"time":102.000}},{"noteOn":{"time":104.000}},{"noteOn":{"time":104.000}},{"noteOn":{"time":106.000}},{"noteOn":{"time":106.000}},{"noteOn":{"time":108.000}},{"noteOn":{"time":108.000}},{"noteOn":{"time":110.000}},{"noteOn":{"time":110.000}},{"noteOn":{"time":112.000}},{"noteOn":{"time":112.000}},{"noteOn":{"time":114.000}},{"noteOn":{"time":114.000}},{"noteOn":{"time":116.000}},{"noteOn":{"time":116.000}},{"noteOn":{"time":118.000}},{"noteOn":{"time":118.000}},{"noteOn":{"time":120.000}},{"noteOn":{"time":120.000}},{"noteOn":{"time":122.000}},{"noteOn":{"time":122.000}},{"noteOn":{"time":124.000}},{"noteOn":{"time":124.000}},{"noteOn":{"time":126.000}},{"noteOn":{"time":126.000}},{"noteOn":{"time":128.000}},{"noteOn":{"time":128.000}},{"noteOn":{"time":130.000}},{"noteOn":{"time":130.000}},{"noteOn":{"time":132.000}},{"noteOn":{"time":132.000}},{"noteOn":{"time":134.000}},{"noteOn":{"time":134.000}},{"noteOn":{"time":136.000}},{"noteOn":{"time":136.000}},{"noteOn":{"time":138.000}},{"noteOn":{"time":138.000}},{"noteOn":{"time":140.000}},{"noteOn":{"time":140.000}},{"noteOn":{"time":142.000}},{"noteOn":{"time":142.000}},{"noteOn":{"time":144.000}},{"noteOn":{"time":144.000}},{"noteOn":{"time":146.000}},{"noteOn":{"time":146.000}},{"noteOn":{"time":148.000}},{"noteOn":{"time":148.000}},{"noteOn":{"time":150.000}},{"noteOn":{"time":150.000}},{"noteOn":{"time":152.000}},{"noteOn":{"time":152.000}},{"noteOn":{"time":154.000}},{"noteOn":{"time":154.000}},{"noteOn":{"time":156.000}},{"noteOn":{"time":156.000}},{"noteOn":{"time":158.000}},{"noteOn":{"time":158.000}},{"noteOn":{"time":160.000}},{"noteOn":{"time":160.000}},{"noteOn":{"time":162.000}},{"noteOn":{"time":162.000}},{"noteOn":{"time":164.000}},{"noteOn":{"time":164.000}},{"noteOn":{"time":166.000}},{"noteOn":{"time":166.000}},{"noteOn":{"time":168.000}},{"noteOn":{"time":168.000}},{"noteOn":{"time":170.000}},{"noteOn":{"time":170.000}},{"noteOn":{"time":172.000}},{"noteOn":{"time":172.000}},{"noteOn":{"time":174.000}},{"noteOn":{"time":174.000}},{"noteOn":{"time":176.000}},{"noteOn":{"time":176.000}},{"noteOn":{"time":178.000}},{"noteOn":{"time":178.000}},{"noteOn":{"time":180.000}},{"noteOn":{"time":180.000}},{"noteOn":{"time":182.000}},{"noteOn":{"time":182.000}},{"noteOn":{"time":184.000}},{"noteOn":{"time":184.000}},{"noteOn":{"time":186.000}},{"noteOn":{"time":186.000}},{"noteOn":{"time":188.000}},{"noteOn":{"time":188.000}},{"noteOn":{"time":190.000}},{"noteOn":{"time":190.000}},{"noteOn":{"time":192.000}},{"noteOn":{"time":192.000}},{"noteOn":{"time":194.000}},{"noteOn":{"time":194.000}},{"noteOn":{"time":196.000}},{"noteOn":{"time":196.000}},{"noteOn":{"time":198.000}},{"noteOn":{"time":198.000}}],"ab018f191c70470f98ac3becb76e6d13":[{"instanceName":""},{"noteOn":{"time":15.000,"k":[{"time":0.000,"pitch":38.000,"volume":0.167},{"time":0.008,"pitch":38.000,"volume":0.333},{"time":0.017,"volume":0.500},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1.000},{"time":0.733,"pitch":38.619},{"time":0.742,"pitch":39.110},{"time":0.750,"pitch":39.500},{"time":0.758,"pitch":39.809},{"time":0.767,"pitch":40.055},{"time":0.775,"pitch":40.250},{"time":0.783,"pitch":40.405},{"time":0.792,"pitch":40.528},{"time":0.800,"pitch":40.625},{"time":0.808,"pitch":40.702},{"time":0.817,"pitch":40.764},{"time":0.825,"pitch":40.813},{"time":0.833,"pitch":40.851},{"time":0.842,"pitch":40.882},{"time":0.850,"pitch":40.906},{"time":0.858,"pitch":40.926},{"time":0.867,"pitch":40.941},{"time":0.875,"pitch":40.953},{"time":0.883,"pitch":40.963},{"time":0.892,"pitch":40.970},{"time":0.900,"pitch":40.977},{"time":0.908,"pitch":40.981},{"time":0.917,"pitch":40.985},{"time":0.925,"pitch":40.988},{"time":0.933,"pitch":40.991},{"time":0.942,"pitch":40.993},{"time":0.950,"pitch":40.994},{"time":0.958,"pitch":40.995},{"time":0.967,"pitch":40.996},{"time":0.975,"pitch":40.997},{"time":0.983,"pitch":40.998},{"time":1.000,"pitch":40.999},{"time":1.042,"pitch":41.000},{"time":1.258,"pitch":40.381},{"time":1.267,"pitch":39.890},{"time":1.275,"pitch":39.500},{"time":1.283,"pitch":39.191},{"time":1.292,"pitch":38.945},{"time":1.300,"pitch":38.750},{"time":1.308,"pitch":38.595},{"time":1.317,"pitch":38.472},{"time":1.325,"pitch":38.375},{"time":1.333,"pitch":38.298},{"time":1.342,"pitch":38.236},{"time":1.350,"pitch":38.187},{"time":1.358,"pitch":38.149},{"time":1.367,"pitch":38.118},{"time":1.375,"pitch":38.094},{"time":1.383,"pitch":38.074},{"time":1.392,"pitch":38.059},{"time":1.400,"pitch":38.047},{"time":1.408,"pitch":38.037},{"time":1.417,"pitch":38.030},{"time":1.425,"pitch":38.023},{"time":1.433,"pitch":38.019},{"time":1.442,"pitch":38.015},{"time":1.450,"pitch":38.012},{"time":1.458,"pitch":38.009},{"time":1.467,"pitch":38.007},{"time":1.475,"pitch":38.006},{"time":1.483,"pitch":38.005},{"time":1.492,"pitch":38.004},{"time":1.500,"pitch":38.622},{"time":1.508,"pitch":39.112},{"time":1.517,"pitch":39.502},{"time":1.525,"pitch":39.811},{"time":1.533,"pitch":40.056},{"time":1.542,"pitch":40.251},{"time":1.550,"pitch":40.405},{"time":1.558,"pitch":40.528},{"time":1.567,"pitch":40.625},{"time":1.575,"pitch":40.703},{"time":1.583,"pitch":40.764},{"time":1.592,"pitch":40.813},{"time":1.600,"pitch":40.851},{"time":1.608,"pitch":40.882},{"time":1.617,"pitch":40.906},{"time":1.625,"pitch":40.926},{"time":1.633,"pitch":40.941},{"time":1.642,"pitch":40.953},{"time":1.650,"pitch":40.963},{"time":1.658,"pitch":40.971},{"time":1.667,"pitch":40.977},{"time":1.675,"pitch":40.981},{"time":1.683,"pitch":40.985},{"time":1.692,"pitch":40.988},{"time":1.700,"pitch":40.991},{"time":1.708,"pitch":40.993},{"time":1.717,"pitch":40.994},{"time":1.725,"pitch":40.995},{"time":1.733,"pitch":40.996},{"time":1.742,"pitch":40.997},{"time":1.750,"pitch":40.998},{"time":1.767,"pitch":40.999},{"time":1.808,"pitch":41.000},{"time":2.008,"pitch":40.381},{"time":2.017,"pitch":39.890},{"time":2.025,"pitch":39.500},{"time":2.033,"pitch":39.191},{"time":2.042,"pitch":38.945},{"time":2.050,"pitch":38.750},{"time":2.058,"pitch":38.595},{"time":2.067,"pitch":38.472},{"time":2.075,"pitch":38.375},{"time":2.083,"pitch":38.298},{"time":2.092,"pitch":38.236},{"time":2.100,"pitch":38.187},{"time":2.108,"pitch":38.149},{"time":2.117,"pitch":38.118},{"time":2.125,"pitch":38.094},{"time":2.133,"pitch":38.074},{"time":2.142,"pitch":38.059},{"time":2.150,"pitch":38.047},{"time":2.158,"pitch":38.037},{"time":2.167,"pitch":38.030},{"time":2.175,"pitch":38.023},{"time":2.183,"pitch":38.019},{"time":2.192,"pitch":38.015},{"time":2.200,"pitch":38.012},{"time":2.208,"pitch":38.009},{"time":2.217,"pitch":38.007},{"time":2.225,"pitch":38.006},{"time":2.233,"pitch":38.005},{"time":2.242,"pitch":38.004},{"time":2.250,"pitch":38.003},{"time":2.258,"pitch":38.002},{"time":2.275,"pitch":38.001},{"time":2.317,"pitch":38.000},{"time":2.758,"pitch":37.587},{"time":2.767,"pitch":37.260},{"time":2.775,"pitch":37.000},{"time":2.783,"pitch":36.794},{"time":2.792,"pitch":36.630},{"time":2.800,"pitch":36.500},{"time":2.808,"pitch":36.397},{"time":2.817,"pitch":36.315},{"time":2.825,"pitch":36.250},{"time":2.833,"pitch":36.198},{"time":2.842,"pitch":36.157},{"time":2.850,"pitch":36.125},{"time":2.858,"pitch":36.099},{"time":2.867,"pitch":36.079},{"time":2.875,"pitch":36.063},{"time":2.883,"pitch":36.050},{"time":2.892,"pitch":36.039},{"time":2.900,"pitch":36.031},{"time":2.908,"pitch":36.025},{"time":2.917,"pitch":36.020},{"time":2.925,"pitch":36.016},{"time":2.933,"pitch":36.012},{"time":2.942,"pitch":36.010},{"time":2.950,"pitch":36.008},{"time":2.958,"pitch":36.006},{"time":2.967,"pitch":36.005},{"time":2.975,"pitch":36.004},{"time":2.983,"pitch":36.003},{"time":2.992,"pitch":36.002},{"time":3.017,"pitch":36.001},{"time":3.050,"pitch":36.000},{"time":3.258,"pitch":35.381},{"time":3.267,"pitch":34.890},{"time":3.275,"pitch":34.500},{"time":3.283,"pitch":34.191},{"time":3.292,"pitch":33.945},{"time":3.300,"pitch":33.750},{"time":3.308,"pitch":33.595},{"time":3.317,"pitch":33.472},{"time":3.325,"pitch":33.375},{"time":3.333,"pitch":33.298},{"time":3.342,"pitch":33.236},{"time":3.350,"pitch":33.188},{"time":3.358,"pitch":33.149},{"time":3.367,"pitch":33.118},{"time":3.375,"pitch":33.094},{"time":3.383,"pitch":33.074},{"time":3.392,"pitch":33.059},{"time":3.400,"pitch":33.047},{"time":3.408,"pitch":33.037},{"time":3.417,"pitch":33.030},{"time":3.425,"pitch":33.023},{"time":3.433,"pitch":33.019},{"time":3.442,"pitch":33.015},{"time":3.450,"pitch":33.012},{"time":3.458,"pitch":33.009},{"time":3.467,"pitch":33.007},{"time":3.475,"pitch":33.006},{"time":3.483,"pitch":33.005},{"time":3.492,"pitch":33.004},{"time":3.500,"pitch":33.003},{"time":3.508,"pitch":33.621},{"time":3.517,"pitch":34.112},{"time":3.525,"pitch":34.501},{"time":3.533,"pitch":34.811},{"time":3.542,"pitch":35.056},{"time":3.550,"pitch":35.251},{"time":3.558,"pitch":35.405},{"time":3.567,"pitch":35.528},{"time":3.575,"pitch":35.625},{"time":3.583,"pitch":35.703},{"time":3.592,"pitch":35.764},{"time":3.600,"pitch":35.813},{"time":3.608,"pitch":35.851},{"time":3.617,"pitch":35.882},{"time":3.625,"pitch":35.906},{"time":3.633,"pitch":35.926},{"time":3.642,"pitch":35.941},{"time":3.650,"pitch":35.953},{"time":3.658,"pitch":35.963},{"time":3.667,"pitch":35.970},{"time":3.675,"pitch":35.977},{"time":3.683,"pitch":35.981},{"time":3.692,"pitch":35.985},{"time":3.700,"pitch":35.988},{"time":3.708,"pitch":35.991},{"time":3.717,"pitch":35.993},{"time":3.725,"pitch":35.994},{"time":3.733,"pitch":35.995},{"time":3.742,"pitch":35.996},{"time":3.750,"pitch":35.997},{"time":3.758,"pitch":35.998},{"time":3.775,"pitch":35.999},{"time":3.817,"pitch":36.000},{"time":4.000,"pitch":36.413},{"time":4.008,"pitch":36.740},{"time":4.017,"pitch":37.000},{"time":4.025,"pitch":37.206},{"time":4.033,"pitch":37.370},{"time":4.042,"pitch":37.500},{"time":4.050,"pitch":37.603},{"time":4.058,"pitch":37.685},{"time":4.067,"pitch":37.750},{"time":4.075,"pitch":37.802},{"time":4.083,"pitch":37.843},{"time":4.092,"pitch":37.875},{"time":4.100,"pitch":37.901},{"time":4.108,"pitch":37.921},{"time":4.117,"pitch":37.937},{"time":4.125,"pitch":37.950},{"time":4.133,"pitch":37.961},{"time":4.142,"pitch":37.969},{"time":4.150,"pitch":37.975},{"time":4.158,"pitch":37.980},{"time":4.167,"pitch":37.984},{"time":4.175,"pitch":37.988},{"time":4.183,"pitch":37.990},{"time":4.192,"pitch":37.992},{"time":4.200,"pitch":37.994},{"time":4.208,"pitch":37.995},{"time":4.217,"pitch":37.996},{"time":4.225,"pitch":37.997},{"time":4.233,"pitch":37.998},{"time":4.258,"pitch":37.999},{"time":4.292,"pitch":38.000},{"time":4.733,"pitch":38.619},{"time":4.742,"pitch":39.110},{"time":4.750,"pitch":39.500},{"time":4.758,"pitch":39.809},{"time":4.767,"pitch":40.055},{"time":4.775,"pitch":40.250},{"time":4.783,"pitch":40.405},{"time":4.792,"pitch":40.528},{"time":4.800,"pitch":40.625},{"time":4.808,"pitch":40.702},{"time":4.817,"pitch":40.764},{"time":4.825,"pitch":40.812},{"time":4.833,"pitch":40.851},{"time":4.842,"pitch":40.882},{"time":4.850,"pitch":40.906},{"time":4.858,"pitch":40.926},{"time":4.867,"pitch":40.941},{"time":4.875,"pitch":40.953},{"time":4.883,"pitch":40.963},{"time":4.892,"pitch":40.970},{"time":4.900,"pitch":40.977},{"time":4.908,"pitch":40.981},{"time":4.917,"pitch":40.985},{"time":4.925,"pitch":40.988},{"time":4.933,"pitch":40.991},{"time":4.942,"pitch":40.993},{"time":4.950,"pitch":40.994},{"time":4.958,"pitch":40.995},{"time":4.967,"pitch":40.996},{"time":4.975,"pitch":40.997},{"time":4.983,"pitch":40.998},{"time":5.000,"pitch":40.999},{"time":5.042,"pitch":41.000},{"time":5.258,"pitch":40.381},{"time":5.267,"pitch":39.890},{"time":5.275,"pitch":39.500},{"time":5.283,"pitch":39.191},{"time":5.292,"pitch":38.945},{"time":5.300,"pitch":38.750},{"time":5.308,"pitch":38.595},{"time":5.317,"pitch":38.472},{"time":5.325,"pitch":38.375},{"time":5.333,"pitch":38.298},{"time":5.342,"pitch":38.236},{"time":5.350,"pitch":38.187},{"time":5.358,"pitch":38.149},{"time":5.367,"pitch":38.118},{"time":5.375,"pitch":38.094},{"time":5.383,"pitch":38.074},{"time":5.392,"pitch":38.059},{"time":5.400,"pitch":38.047},{"time":5.408,"pitch":38.037},{"time":5.417,"pitch":38.030},{"time":5.425,"pitch":38.023},{"time":5.433,"pitch":38.019},{"time":5.442,"pitch":38.015},{"time":5.450,"pitch":38.012},{"time":5.458,"pitch":38.009},{"time":5.467,"pitch":38.007},{"time":5.475,"pitch":38.006},{"time":5.483,"pitch":38.005},{"time":5.492,"pitch":38.004},{"time":5.500,"pitch":38.622},{"time":5.508,"pitch":39.112},{"time":5.517,"pitch":39.502},{"time":5.525,"pitch":39.811},{"time":5.533,"pitch":40.056},{"time":5.542,"pitch":40.251},{"time":5.550,"pitch":40.405},{"time":5.558,"pitch":40.528},{"time":5.567,"pitch":40.625},{"time":5.575,"pitch":40.703},{"time":5.583,"pitch":40.764},{"time":5.592,"pitch":40.813},{"time":5.600,"pitch":40.851},{"time":5.608,"pitch":40.882},{"time":5.617,"pitch":40.906},{"time":5.625,"pitch":40.926},{"time":5.633,"pitch":40.941},{"time":5.642,"pitch":40.953},{"time":5.650,"pitch":40.963},{"time":5.658,"pitch":40.971},{"time":5.667,"pitch":40.977},{"time":5.675,"pitch":40.981},{"time":5.683,"pitch":40.985},{"time":5.692,"pitch":40.988},{"time":5.700,"pitch":40.991},{"time":5.708,"pitch":40.993},{"time":5.717,"pitch":40.994},{"time":5.725,"pitch":40.995},{"time":5.733,"pitch":40.996},{"time":5.742,"pitch":40.997},{"time":5.750,"pitch":40.998},{"time":5.767,"pitch":40.999},{"time":5.808,"pitch":41.000},{"time":6.008,"pitch":40.381},{"time":6.017,"pitch":39.890},{"time":6.025,"pitch":39.500},{"time":6.033,"pitch":39.191},{"time":6.042,"pitch":38.945},{"time":6.050,"pitch":38.750},{"time":6.058,"pitch":38.595},{"time":6.067,"pitch":38.472},{"time":6.075,"pitch":38.375},{"time":6.083,"pitch":38.298},{"time":6.092,"pitch":38.236},{"time":6.100,"pitch":38.187},{"time":6.108,"pitch":38.149},{"time":6.117,"pitch":38.118},{"time":6.125,"pitch":38.094},{"time":6.133,"pitch":38.074},{"time":6.142,"pitch":38.059},{"time":6.150,"pitch":38.047},{"time":6.158,"pitch":38.037},{"time":6.167,"pitch":38.030},{"time":6.175,"pitch":38.023},{"time":6.183,"pitch":38.019},{"time":6.192,"pitch":38.015},{"time":6.200,"pitch":38.012},{"time":6.208,"pitch":38.009},{"time":6.217,"pitch":38.007},{"time":6.225,"pitch":38.006},{"time":6.233,"pitch":38.005},{"time":6.242,"pitch":38.004},{"time":6.250,"pitch":38.003},{"time":6.258,"pitch":38.002},{"time":6.275,"pitch":38.001},{"time":6.317,"pitch":38.000},{"time":6.758,"pitch":37.587},{"time":6.767,"pitch":37.260},{"time":6.775,"pitch":37.000},{"time":6.783,"pitch":36.794},{"time":6.792,"pitch":36.630},{"time":6.800,"pitch":36.500},{"time":6.808,"pitch":36.397},{"time":6.817,"pitch":36.315},{"time":6.825,"pitch":36.250},{"time":6.833,"pitch":36.198},{"time":6.842,"pitch":36.157},{"time":6.850,"pitch":36.125},{"time":6.858,"pitch":36.099},{"time":6.867,"pitch":36.079},{"time":6.875,"pitch":36.063},{"time":6.883,"pitch":36.050},{"time":6.892,"pitch":36.039},{"time":6.900,"pitch":36.031},{"time":6.908,"pitch":36.025},{"time":6.917,"pitch":36.020},{"time":6.925,"pitch":36.016},{"time":6.933,"pitch":36.012},{"time":6.942,"pitch":36.010},{"time":6.950,"pitch":36.008},{"time":6.958,"pitch":36.006},{"time":6.967,"pitch":36.005},{"time":6.975,"pitch":36.004},{"time":6.983,"pitch":36.003},{"time":6.992,"pitch":36.002},{"time":7.017,"pitch":36.001},{"time":7.050,"pitch":36.000},{"time":7.258,"pitch":35.381},{"time":7.267,"pitch":34.890},{"time":7.275,"pitch":34.500},{"time":7.283,"pitch":34.191},{"time":7.292,"pitch":33.945},{"time":7.300,"pitch":33.750},{"time":7.308,"pitch":33.595},{"time":7.317,"pitch":33.472},{"time":7.325,"pitch":33.375},{"time":7.333,"pitch":33.298},{"time":7.342,"pitch":33.236},{"time":7.350,"pitch":33.188},{"time":7.358,"pitch":33.149},{"time":7.367,"pitch":33.118},{"time":7.375,"pitch":33.094},{"time":7.383,"pitch":33.074},{"time":7.392,"pitch":33.059},{"time":7.400,"pitch":33.047},{"time":7.408,"pitch":33.037},{"time":7.417,"pitch":33.030},{"time":7.425,"pitch":33.023},{"time":7.433,"pitch":33.019},{"time":7.442,"pitch":33.015},{"time":7.450,"pitch":33.012},{"time":7.458,"pitch":33.009},{"time":7.467,"pitch":33.007},{"time":7.475,"pitch":33.006},{"time":7.483,"pitch":33.005},{"time":7.492,"pitch":33.004},{"time":7.500,"pitch":33.003},{"time":7.508,"pitch":33.621},{"time":7.517,"pitch":34.112},{"time":7.525,"pitch":34.501},{"time":7.533,"pitch":34.811},{"time":7.542,"pitch":35.056},{"time":7.550,"pitch":35.251},{"time":7.558,"pitch":35.405},{"time":7.567,"pitch":35.528},{"time":7.575,"pitch":35.625},{"time":7.583,"pitch":35.703},{"time":7.592,"pitch":35.764},{"time":7.600,"pitch":35.813},{"time":7.608,"pitch":35.851},{"time":7.617,"pitch":35.882},{"time":7.625,"pitch":35.906},{"time":7.633,"pitch":35.926},{"time":7.642,"pitch":35.941},{"time":7.650,"pitch":35.953},{"time":7.658,"pitch":35.963},{"time":7.667,"pitch":35.970},{"time":7.675,"pitch":35.977},{"time":7.683,"pitch":35.981},{"time":7.692,"pitch":35.985},{"time":7.700,"pitch":35.988},{"time":7.708,"pitch":35.991},{"time":7.717,"pitch":35.993},{"time":7.725,"pitch":35.994},{"time":7.733,"pitch":35.995},{"time":7.742,"pitch":35.996},{"time":7.750,"pitch":35.997},{"time":7.758,"pitch":35.998},{"time":7.775,"pitch":35.999},{"time":7.817,"pitch":36.000},{"time":8.000,"pitch":36.413},{"time":8.008,"pitch":36.740},{"time":8.017,"pitch":37.000},{"time":8.025,"pitch":37.206},{"time":8.033,"pitch":37.370},{"time":8.042,"pitch":37.500},{"time":8.050,"pitch":37.603},{"time":8.058,"pitch":37.685},{"time":8.067,"pitch":37.750},{"time":8.075,"pitch":37.802},{"time":8.083,"pitch":37.843},{"time":8.092,"pitch":37.875},{"time":8.100,"pitch":37.901},{"time":8.108,"pitch":37.921},{"time":8.117,"pitch":37.937},{"time":8.125,"pitch":37.950},{"time":8.133,"pitch":37.961},{"time":8.142,"pitch":37.969},{"time":8.150,"pitch":37.975},{"time":8.158,"pitch":37.980},{"time":8.167,"pitch":37.984},{"time":8.175,"pitch":37.988},{"time":8.183,"pitch":37.990},{"time":8.192,"pitch":37.992},{"time":8.200,"pitch":37.994},{"time":8.208,"pitch":37.995},{"time":8.217,"pitch":37.996},{"time":8.225,"pitch":37.997},{"time":8.233,"pitch":37.998},{"time":8.258,"pitch":37.999},{"time":8.292,"pitch":38.000},{"time":8.733,"pitch":38.619},{"time":8.742,"pitch":39.110},{"time":8.750,"pitch":39.500},{"time":8.758,"pitch":39.809},{"time":8.767,"pitch":40.055},{"time":8.775,"pitch":40.250},{"time":8.783,"pitch":40.405},{"time":8.792,"pitch":40.528},{"time":8.800,"pitch":40.625},{"time":8.808,"pitch":40.702},{"time":8.817,"pitch":40.764},{"time":8.825,"pitch":40.812},{"time":8.833,"pitch":40.851},{"time":8.842,"pitch":40.882},{"time":8.850,"pitch":40.906},{"time":8.858,"pitch":40.926},{"time":8.867,"pitch":40.941},{"time":8.875,"pitch":40.953},{"time":8.883,"pitch":40.963},{"time":8.892,"pitch":40.970},{"time":8.900,"pitch":40.977},{"time":8.908,"pitch":40.981},{"time":8.917,"pitch":40.985},{"time":8.925,"pitch":40.988},{"time":8.933,"pitch":40.991},{"time":8.942,"pitch":40.993},{"time":8.950,"pitch":40.994},{"time":8.958,"pitch":40.995},{"time":8.967,"pitch":40.996},{"time":8.975,"pitch":40.997},{"time":8.983,"pitch":40.998},{"time":9.000,"pitch":40.999},{"time":9.042,"pitch":41.000},{"time":9.258,"pitch":40.381},{"time":9.267,"pitch":39.890},{"time":9.275,"pitch":39.500},{"time":9.283,"pitch":39.191},{"time":9.292,"pitch":38.945},{"time":9.300,"pitch":38.750},{"time":9.308,"pitch":38.595},{"time":9.317,"pitch":38.472},{"time":9.325,"pitch":38.375},{"time":9.333,"pitch":38.298},{"time":9.342,"pitch":38.236},{"time":9.350,"pitch":38.187},{"time":9.358,"pitch":38.149},{"time":9.367,"pitch":38.118},{"time":9.375,"pitch":38.094},{"time":9.383,"pitch":38.074},{"time":9.392,"pitch":38.059},{"time":9.400,"pitch":38.047},{"time":9.408,"pitch":38.037},{"time":9.417,"pitch":38.030},{"time":9.425,"pitch":38.023},{"time":9.433,"pitch":38.019},{"time":9.442,"pitch":38.015},{"time":9.450,"pitch":38.012},{"time":9.458,"pitch":38.009},{"time":9.467,"pitch":38.007},{"time":9.475,"pitch":38.006},{"time":9.483,"pitch":38.005},{"time":9.492,"pitch":38.004},{"time":9.500,"pitch":38.622},{"time":9.508,"pitch":39.112},{"time":9.517,"pitch":39.502},{"time":9.525,"pitch":39.811},{"time":9.533,"pitch":40.056},{"time":9.542,"pitch":40.251},{"time":9.550,"pitch":40.405},{"time":9.558,"pitch":40.528},{"time":9.567,"pitch":40.625},{"time":9.575,"pitch":40.703},{"time":9.583,"pitch":40.764},{"time":9.592,"pitch":40.813},{"time":9.600,"pitch":40.851},{"time":9.608,"pitch":40.882},{"time":9.617,"pitch":40.906},{"time":9.625,"pitch":40.926},{"time":9.633,"pitch":40.941},{"time":9.642,"pitch":40.953},{"time":9.650,"pitch":40.963},{"time":9.658,"pitch":40.971},{"time":9.667,"pitch":40.977},{"time":9.675,"pitch":40.981},{"time":9.683,"pitch":40.985},{"time":9.692,"pitch":40.988},{"time":9.700,"pitch":40.991},{"time":9.708,"pitch":40.993},{"time":9.717,"pitch":40.994},{"time":9.725,"pitch":40.995},{"time":9.733,"pitch":40.996},{"time":9.742,"pitch":40.997},{"time":9.750,"pitch":40.998},{"time":9.767,"pitch":40.999},{"time":9.808,"pitch":41.000},{"time":10.008,"pitch":40.381},{"time":10.017,"pitch":39.890},{"time":10.025,"pitch":39.500},{"time":10.033,"pitch":39.191},{"time":10.042,"pitch":38.945},{"time":10.050,"pitch":38.750},{"time":10.058,"pitch":38.595},{"time":10.067,"pitch":38.472},{"time":10.075,"pitch":38.375},{"time":10.083,"pitch":38.298},{"time":10.092,"pitch":38.236},{"time":10.100,"pitch":38.187},{"time":10.108,"pitch":38.149},{"time":10.117,"pitch":38.118},{"time":10.125,"pitch":38.094},{"time":10.133,"pitch":38.074},{"time":10.142,"pitch":38.059},{"time":10.150,"pitch":38.047},{"time":10.158,"pitch":38.037},{"time":10.167,"pitch":38.030},{"time":10.175,"pitch":38.023},{"time":10.183,"pitch":38.019},{"time":10.192,"pitch":38.015},{"time":10.200,"pitch":38.012},{"time":10.208,"pitch":38.009},{"time":10.217,"pitch":38.007},{"time":10.225,"pitch":38.006},{"time":10.233,"pitch":38.005},{"time":10.242,"pitch":38.004},{"time":10.250,"pitch":38.003},{"time":10.258,"pitch":38.002},{"time":10.275,"pitch":38.001},{"time":10.317,"pitch":38.000},{"time":10.758,"pitch":37.587},{"time":10.767,"pitch":37.260},{"time":10.775,"pitch":37.000},{"time":10.783,"pitch":36.794},{"time":10.792,"pitch":36.630},{"time":10.800,"pitch":36.500},{"time":10.808,"pitch":36.397},{"time":10.817,"pitch":36.315},{"time":10.825,"pitch":36.250},{"time":10.833,"pitch":36.198},{"time":10.842,"pitch":36.157},{"time":10.850,"pitch":36.125},{"time":10.858,"pitch":36.099},{"time":10.867,"pitch":36.079},{"time":10.875,"pitch":36.063},{"time":10.883,"pitch":36.050},{"time":10.892,"pitch":36.039},{"time":10.900,"pitch":36.031},{"time":10.908,"pitch":36.025},{"time":10.917,"pitch":36.020},{"time":10.925,"pitch":36.016},{"time":10.933,"pitch":36.012},{"time":10.942,"pitch":36.010},{"time":10.950,"pitch":36.008},{"time":10.958,"pitch":36.006},{"time":10.967,"pitch":36.005},{"time":10.975,"pitch":36.004},{"time":10.983,"pitch":36.003},{"time":10.992,"pitch":36.002},{"time":11.017,"pitch":36.001},{"time":11.050,"pitch":36.000},{"time":11.258,"pitch":35.381},{"time":11.267,"pitch":34.890},{"time":11.275,"pitch":34.500},{"time":11.283,"pitch":34.191},{"time":11.292,"pitch":33.945},{"time":11.300,"pitch":33.750},{"time":11.308,"pitch":33.595},{"time":11.317,"pitch":33.472},{"time":11.325,"pitch":33.375},{"time":11.333,"pitch":33.298},{"time":11.342,"pitch":33.236},{"time":11.350,"pitch":33.188},{"time":11.358,"pitch":33.149},{"time":11.367,"pitch":33.118},{"time":11.375,"pitch":33.094},{"time":11.383,"pitch":33.074},{"time":11.392,"pitch":33.059},{"time":11.400,"pitch":33.047},{"time":11.408,"pitch":33.037},{"time":11.417,"pitch":33.030},{"time":11.425,"pitch":33.023},{"time":11.433,"pitch":33.019},{"time":11.442,"pitch":33.015},{"time":11.450,"pitch":33.012},{"time":11.458,"pitch":33.009},{"time":11.467,"pitch":33.007},{"time":11.475,"pitch":33.006},{"time":11.483,"pitch":33.005},{"time":11.492,"pitch":33.004},{"time":11.500,"pitch":33.003},{"time":11.508,"pitch":33.621},{"time":11.517,"pitch":34.112},{"time":11.525,"pitch":34.501},{"time":11.533,"pitch":34.811},{"time":11.542,"pitch":35.056},{"time":11.550,"pitch":35.251},{"time":11.558,"pitch":35.405},{"time":11.567,"pitch":35.528},{"time":11.575,"pitch":35.625},{"time":11.583,"pitch":35.703},{"time":11.592,"pitch":35.764},{"time":11.600,"pitch":35.813},{"time":11.608,"pitch":35.851},{"time":11.617,"pitch":35.882},{"time":11.625,"pitch":35.906},{"time":11.633,"pitch":35.926},{"time":11.642,"pitch":35.941},{"time":11.650,"pitch":35.953},{"time":11.658,"pitch":35.963},{"time":11.667,"pitch":35.970},{"time":11.675,"pitch":35.977},{"time":11.683,"pitch":35.981},{"time":11.692,"pitch":35.985},{"time":11.700,"pitch":35.988},{"time":11.708,"pitch":35.991},{"time":11.717,"pitch":35.993},{"time":11.725,"pitch":35.994},{"time":11.733,"pitch":35.995},{"time":11.742,"pitch":35.996},{"time":11.750,"pitch":35.997},{"time":11.758,"pitch":35.998},{"time":11.775,"pitch":35.999},{"time":11.817,"pitch":36.000},{"time":12.000,"pitch":36.413},{"time":12.008,"pitch":36.740},{"time":12.017,"pitch":37.000},{"time":12.025,"pitch":37.206},{"time":12.033,"pitch":37.370},{"time":12.042,"pitch":37.500},{"time":12.050,"pitch":37.603},{"time":12.058,"pitch":37.685},{"time":12.067,"pitch":37.750},{"time":12.075,"pitch":37.802},{"time":12.083,"pitch":37.843},{"time":12.092,"pitch":37.875},{"time":12.100,"pitch":37.901},{"time":12.108,"pitch":37.921},{"time":12.117,"pitch":37.937},{"time":12.125,"pitch":37.950},{"time":12.133,"pitch":37.961},{"time":12.142,"pitch":37.969},{"time":12.150,"pitch":37.975},{"time":12.158,"pitch":37.980},{"time":12.167,"pitch":37.984},{"time":12.175,"pitch":37.988},{"time":12.183,"pitch":37.990},{"time":12.192,"pitch":37.992},{"time":12.200,"pitch":37.994},{"time":12.208,"pitch":37.995},{"time":12.217,"pitch":37.996},{"time":12.225,"pitch":37.997},{"time":12.233,"pitch":37.998},{"time":12.258,"pitch":37.999},{"time":12.292,"pitch":38.000},{"time":12.733,"pitch":38.619},{"time":12.742,"pitch":39.110},{"time":12.750,"pitch":39.500},{"time":12.758,"pitch":39.809},{"time":12.767,"pitch":40.055},{"time":12.775,"pitch":40.250},{"time":12.783,"pitch":40.405},{"time":12.792,"pitch":40.528},{"time":12.800,"pitch":40.625},{"time":12.808,"pitch":40.702},{"time":12.817,"pitch":40.764},{"time":12.825,"pitch":40.812},{"time":12.833,"pitch":40.851},{"time":12.842,"pitch":40.882},{"time":12.850,"pitch":40.906},{"time":12.858,"pitch":40.926},{"time":12.867,"pitch":40.941},{"time":12.875,"pitch":40.953},{"time":12.883,"pitch":40.963},{"time":12.892,"pitch":40.970},{"time":12.900,"pitch":40.977},{"time":12.908,"pitch":40.981},{"time":12.917,"pitch":40.985},{"time":12.925,"pitch":40.988},{"time":12.933,"pitch":40.991},{"time":12.942,"pitch":40.993},{"time":12.950,"pitch":40.994},{"time":12.958,"pitch":40.995},{"time":12.967,"pitch":40.996},{"time":12.975,"pitch":40.997},{"time":12.983,"pitch":40.998},{"time":13.000,"pitch":40.999},{"time":13.042,"pitch":41.000},{"time":13.258,"pitch":40.381},{"time":13.267,"pitch":39.890},{"time":13.275,"pitch":39.500},{"time":13.283,"pitch":39.191},{"time":13.292,"pitch":38.945},{"time":13.300,"pitch":38.750},{"time":13.308,"pitch":38.595},{"time":13.317,"pitch":38.472},{"time":13.325,"pitch":38.375},{"time":13.333,"pitch":38.298},{"time":13.342,"pitch":38.236},{"time":13.350,"pitch":38.187},{"time":13.358,"pitch":38.149},{"time":13.367,"pitch":38.118},{"time":13.375,"pitch":38.094},{"time":13.383,"pitch":38.074},{"time":13.392,"pitch":38.059},{"time":13.400,"pitch":38.047},{"time":13.408,"pitch":38.037},{"time":13.417,"pitch":38.030},{"time":13.425,"pitch":38.023},{"time":13.433,"pitch":38.019},{"time":13.442,"pitch":38.015},{"time":13.450,"pitch":38.012},{"time":13.458,"pitch":38.009},{"time":13.467,"pitch":38.007},{"time":13.475,"pitch":38.006},{"time":13.483,"pitch":38.005},{"time":13.492,"pitch":38.004},{"time":13.500,"pitch":38.622},{"time":13.508,"pitch":39.112},{"time":13.517,"pitch":39.502},{"time":13.525,"pitch":39.811},{"time":13.533,"pitch":40.056},{"time":13.542,"pitch":40.251},{"time":13.550,"pitch":40.405},{"time":13.558,"pitch":40.528},{"time":13.567,"pitch":40.625},{"time":13.575,"pitch":40.703},{"time":13.583,"pitch":40.764},{"time":13.592,"pitch":40.813},{"time":13.600,"pitch":40.851},{"time":13.608,"pitch":40.882},{"time":13.617,"pitch":40.906},{"time":13.625,"pitch":40.926},{"time":13.633,"pitch":40.941},{"time":13.642,"pitch":40.953},{"time":13.650,"pitch":40.963},{"time":13.658,"pitch":40.971},{"time":13.667,"pitch":40.977},{"time":13.675,"pitch":40.981},{"time":13.683,"pitch":40.985},{"time":13.692,"pitch":40.988},{"time":13.700,"pitch":40.991},{"time":13.708,"pitch":40.993},{"time":13.717,"pitch":40.994},{"time":13.725,"pitch":40.995},{"time":13.733,"pitch":40.996},{"time":13.742,"pitch":40.997},{"time":13.750,"pitch":40.998},{"time":13.767,"pitch":40.999},{"time":13.808,"pitch":41.000},{"time":14.008,"pitch":40.381},{"time":14.017,"pitch":39.890},{"time":14.025,"pitch":39.500},{"time":14.033,"pitch":39.191},{"time":14.042,"pitch":38.945},{"time":14.050,"pitch":38.750},{"time":14.058,"pitch":38.595},{"time":14.067,"pitch":38.472},{"time":14.075,"pitch":38.375},{"time":14.083,"pitch":38.298},{"time":14.092,"pitch":38.236},{"time":14.100,"pitch":38.187},{"time":14.108,"pitch":38.149},{"time":14.117,"pitch":38.118},{"time":14.125,"pitch":38.094},{"time":14.133,"pitch":38.074},{"time":14.142,"pitch":38.059},{"time":14.150,"pitch":38.047},{"time":14.158,"pitch":38.037},{"time":14.167,"pitch":38.030},{"time":14.175,"pitch":38.023},{"time":14.183,"pitch":38.019},{"time":14.192,"pitch":38.015},{"time":14.200,"pitch":38.012},{"time":14.208,"pitch":38.009},{"time":14.217,"pitch":38.007},{"time":14.225,"pitch":38.006},{"time":14.233,"pitch":38.005},{"time":14.242,"pitch":38.004},{"time":14.250,"pitch":38.003},{"time":14.258,"pitch":38.002},{"time":14.275,"pitch":38.001},{"time":14.317,"pitch":38.000},{"time":14.758,"pitch":37.587},{"time":14.767,"pitch":37.260},{"time":14.775,"pitch":37.000},{"time":14.783,"pitch":36.794},{"time":14.792,"pitch":36.630},{"time":14.800,"pitch":36.500},{"time":14.808,"pitch":36.397},{"time":14.817,"pitch":36.315},{"time":14.825,"pitch":36.250},{"time":14.833,"pitch":36.198},{"time":14.842,"pitch":36.157},{"time":14.850,"pitch":36.125},{"time":14.858,"pitch":36.099},{"time":14.867,"pitch":36.079},{"time":14.875,"pitch":36.063},{"time":14.883,"pitch":36.050},{"time":14.892,"pitch":36.039},{"time":14.900,"pitch":36.031},{"time":14.908,"pitch":36.025},{"time":14.917,"pitch":36.020},{"time":14.925,"pitch":36.016},{"time":14.933,"pitch":36.012},{"time":14.942,"pitch":36.010},{"time":14.950,"pitch":36.008},{"time":14.958,"pitch":36.006},{"time":14.967,"pitch":36.005},{"time":14.975,"pitch":36.004},{"time":14.983,"pitch":36.003},{"time":14.992,"pitch":36.002},{"time":15.017,"pitch":36.001},{"time":15.050,"pitch":36.000},{"time":15.258,"pitch":35.381},{"time":15.267,"pitch":34.890},{"time":15.275,"pitch":34.500},{"time":15.283,"pitch":34.191},{"time":15.292,"pitch":33.945},{"time":15.300,"pitch":33.750},{"time":15.308,"pitch":33.595},{"time":15.317,"pitch":33.472},{"time":15.325,"pitch":33.375},{"time":15.333,"pitch":33.298},{"time":15.342,"pitch":33.236},{"time":15.350,"pitch":33.188},{"time":15.358,"pitch":33.149},{"time":15.367,"pitch":33.118},{"time":15.375,"pitch":33.094},{"time":15.383,"pitch":33.074},{"time":15.392,"pitch":33.059},{"time":15.400,"pitch":33.047},{"time":15.408,"pitch":33.037},{"time":15.417,"pitch":33.030},{"time":15.425,"pitch":33.023},{"time":15.433,"pitch":33.019},{"time":15.442,"pitch":33.015},{"time":15.450,"pitch":33.012},{"time":15.458,"pitch":33.009},{"time":15.467,"pitch":33.007},{"time":15.475,"pitch":33.006},{"time":15.483,"pitch":33.005},{"time":15.492,"pitch":33.004},{"time":15.500,"pitch":33.003},{"time":15.508,"pitch":33.621},{"time":15.517,"pitch":34.112},{"time":15.525,"pitch":34.501},{"time":15.533,"pitch":34.811},{"time":15.542,"pitch":35.056},{"time":15.550,"pitch":35.251},{"time":15.558,"pitch":35.405},{"time":15.567,"pitch":35.528},{"time":15.575,"pitch":35.625},{"time":15.583,"pitch":35.703},{"time":15.592,"pitch":35.764},{"time":15.600,"pitch":35.813},{"time":15.608,"pitch":35.851},{"time":15.617,"pitch":35.882},{"time":15.625,"pitch":35.906},{"time":15.633,"pitch":35.926},{"time":15.642,"pitch":35.941},{"time":15.650,"pitch":35.953},{"time":15.658,"pitch":35.963},{"time":15.667,"pitch":35.970},{"time":15.675,"pitch":35.977},{"time":15.683,"pitch":35.981},{"time":15.692,"pitch":35.985},{"time":15.700,"pitch":35.988},{"time":15.708,"pitch":35.991},{"time":15.717,"pitch":35.993},{"time":15.725,"pitch":35.994},{"time":15.733,"pitch":35.995},{"time":15.742,"pitch":35.996},{"time":15.750,"pitch":35.997},{"time":15.758,"pitch":35.998},{"time":15.775,"pitch":35.999},{"time":15.817,"pitch":36.000},{"time":16.000,"pitch":36.413},{"time":16.008,"pitch":36.740},{"time":16.017,"pitch":37.000},{"time":16.025,"pitch":37.206},{"time":16.033,"pitch":37.370},{"time":16.042,"pitch":37.500},{"time":16.050,"pitch":37.603},{"time":16.058,"pitch":37.685},{"time":16.067,"pitch":37.750},{"time":16.075,"pitch":37.802},{"time":16.083,"pitch":37.843},{"time":16.092,"pitch":37.875},{"time":16.100,"pitch":37.901},{"time":16.108,"pitch":37.921},{"time":16.117,"pitch":37.937},{"time":16.125,"pitch":37.950},{"time":16.133,"pitch":37.961},{"time":16.142,"pitch":37.969},{"time":16.150,"pitch":37.975},{"time":16.158,"pitch":37.980},{"time":16.167,"pitch":37.984},{"time":16.175,"pitch":37.988},{"time":16.183,"pitch":37.990},{"time":16.192,"pitch":37.992},{"time":16.200,"pitch":37.994},{"time":16.208,"pitch":37.995},{"time":16.217,"pitch":37.996},{"time":16.225,"pitch":37.997},{"time":16.233,"pitch":37.998},{"time":16.258,"pitch":37.999},{"time":16.292,"pitch":38.000},{"time":16.733,"pitch":38.619},{"time":16.742,"pitch":39.110},{"time":16.750,"pitch":39.500},{"time":16.758,"pitch":39.809},{"time":16.767,"pitch":40.055},{"time":16.775,"pitch":40.250},{"time":16.783,"pitch":40.405},{"time":16.792,"pitch":40.528},{"time":16.800,"pitch":40.625},{"time":16.808,"pitch":40.702},{"time":16.817,"pitch":40.764},{"time":16.825,"pitch":40.812},{"time":16.833,"pitch":40.851},{"time":16.842,"pitch":40.882},{"time":16.850,"pitch":40.906},{"time":16.858,"pitch":40.926},{"time":16.867,"pitch":40.941},{"time":16.875,"pitch":40.953},{"time":16.883,"pitch":40.963},{"time":16.892,"pitch":40.970},{"time":16.900,"pitch":40.977},{"time":16.908,"pitch":40.981},{"time":16.917,"pitch":40.985},{"time":16.925,"pitch":40.988},{"time":16.933,"pitch":40.991},{"time":16.942,"pitch":40.993},{"time":16.950,"pitch":40.994},{"time":16.958,"pitch":40.995},{"time":16.967,"pitch":40.996},{"time":16.975,"pitch":40.997},{"time":16.983,"pitch":40.998},{"time":17.000,"pitch":40.999},{"time":17.042,"pitch":41.000},{"time":17.258,"pitch":40.381},{"time":17.267,"pitch":39.890},{"time":17.275,"pitch":39.500},{"time":17.283,"pitch":39.191},{"time":17.292,"pitch":38.945},{"time":17.300,"pitch":38.750},{"time":17.308,"pitch":38.595},{"time":17.317,"pitch":38.472},{"time":17.325,"pitch":38.375},{"time":17.333,"pitch":38.298},{"time":17.342,"pitch":38.236},{"time":17.350,"pitch":38.187},{"time":17.358,"pitch":38.149},{"time":17.367,"pitch":38.118},{"time":17.375,"pitch":38.094},{"time":17.383,"pitch":38.074},{"time":17.392,"pitch":38.059},{"time":17.400,"pitch":38.047},{"time":17.408,"pitch":38.037},{"time":17.417,"pitch":38.030},{"time":17.425,"pitch":38.023},{"time":17.433,"pitch":38.019},{"time":17.442,"pitch":38.015},{"time":17.450,"pitch":38.012},{"time":17.458,"pitch":38.009},{"time":17.467,"pitch":38.007},{"time":17.475,"pitch":38.006},{"time":17.483,"pitch":38.005},{"time":17.492,"pitch":38.004},{"time":17.500,"pitch":38.622},{"time":17.508,"pitch":39.112},{"time":17.517,"pitch":39.502},{"time":17.525,"pitch":39.811},{"time":17.533,"pitch":40.056},{"time":17.542,"pitch":40.251},{"time":17.550,"pitch":40.405},{"time":17.558,"pitch":40.528},{"time":17.567,"pitch":40.625},{"time":17.575,"pitch":40.703},{"time":17.583,"pitch":40.764},{"time":17.592,"pitch":40.813},{"time":17.600,"pitch":40.851},{"time":17.608,"pitch":40.882},{"time":17.617,"pitch":40.906},{"time":17.625,"pitch":40.926},{"time":17.633,"pitch":40.941},{"time":17.642,"pitch":40.953},{"time":17.650,"pitch":40.963},{"time":17.658,"pitch":40.971},{"time":17.667,"pitch":40.977},{"time":17.675,"pitch":40.981},{"time":17.683,"pitch":40.985},{"time":17.692,"pitch":40.988},{"time":17.700,"pitch":40.991},{"time":17.708,"pitch":40.993},{"time":17.717,"pitch":40.994},{"time":17.725,"pitch":40.995},{"time":17.733,"pitch":40.996},{"time":17.742,"pitch":40.997},{"time":17.750,"pitch":40.998},{"time":17.767,"pitch":40.999},{"time":17.808,"pitch":41.000},{"time":18.008,"pitch":40.381},{"time":18.017,"pitch":39.890},{"time":18.025,"pitch":39.500},{"time":18.033,"pitch":39.191},{"time":18.042,"pitch":38.945},{"time":18.050,"pitch":38.750},{"time":18.058,"pitch":38.595},{"time":18.067,"pitch":38.472},{"time":18.075,"pitch":38.375},{"time":18.083,"pitch":38.298},{"time":18.092,"pitch":38.236},{"time":18.100,"pitch":38.187},{"time":18.108,"pitch":38.149},{"time":18.117,"pitch":38.118},{"time":18.125,"pitch":38.094},{"time":18.133,"pitch":38.074},{"time":18.142,"pitch":38.059},{"time":18.150,"pitch":38.047},{"time":18.158,"pitch":38.037},{"time":18.167,"pitch":38.030},{"time":18.175,"pitch":38.023},{"time":18.183,"pitch":38.019},{"time":18.192,"pitch":38.015},{"time":18.200,"pitch":38.012},{"time":18.208,"pitch":38.009},{"time":18.217,"pitch":38.007},{"time":18.225,"pitch":38.006},{"time":18.233,"pitch":38.005},{"time":18.242,"pitch":38.004},{"time":18.250,"pitch":38.003},{"time":18.258,"pitch":38.002},{"time":18.275,"pitch":38.001},{"time":18.317,"pitch":38.000},{"time":18.758,"pitch":37.587},{"time":18.767,"pitch":37.260},{"time":18.775,"pitch":37.000},{"time":18.783,"pitch":36.794},{"time":18.792,"pitch":36.630},{"time":18.800,"pitch":36.500},{"time":18.808,"pitch":36.397},{"time":18.817,"pitch":36.315},{"time":18.825,"pitch":36.250},{"time":18.833,"pitch":36.198},{"time":18.842,"pitch":36.157},{"time":18.850,"pitch":36.125},{"time":18.858,"pitch":36.099},{"time":18.867,"pitch":36.079},{"time":18.875,"pitch":36.063},{"time":18.883,"pitch":36.050},{"time":18.892,"pitch":36.039},{"time":18.900,"pitch":36.031},{"time":18.908,"pitch":36.025},{"time":18.917,"pitch":36.020},{"time":18.925,"pitch":36.016},{"time":18.933,"pitch":36.012},{"time":18.942,"pitch":36.010},{"time":18.950,"pitch":36.008},{"time":18.958,"pitch":36.006},{"time":18.967,"pitch":36.005},{"time":18.975,"pitch":36.004},{"time":18.983,"pitch":36.003},{"time":18.992,"pitch":36.002},{"time":19.017,"pitch":36.001},{"time":19.050,"pitch":36.000},{"time":19.258,"pitch":35.381},{"time":19.267,"pitch":34.890},{"time":19.275,"pitch":34.500},{"time":19.283,"pitch":34.191},{"time":19.292,"pitch":33.945},{"time":19.300,"pitch":33.750},{"time":19.308,"pitch":33.595},{"time":19.317,"pitch":33.472},{"time":19.325,"pitch":33.375},{"time":19.333,"pitch":33.298},{"time":19.342,"pitch":33.236},{"time":19.350,"pitch":33.188},{"time":19.358,"pitch":33.149},{"time":19.367,"pitch":33.118},{"time":19.375,"pitch":33.094},{"time":19.383,"pitch":33.074},{"time":19.392,"pitch":33.059},{"time":19.400,"pitch":33.047},{"time":19.408,"pitch":33.037},{"time":19.417,"pitch":33.030},{"time":19.425,"pitch":33.023},{"time":19.433,"pitch":33.019},{"time":19.442,"pitch":33.015},{"time":19.450,"pitch":33.012},{"time":19.458,"pitch":33.009},{"time":19.467,"pitch":33.007},{"time":19.475,"pitch":33.006},{"time":19.483,"pitch":33.005},{"time":19.492,"pitch":33.004},{"time":19.500,"pitch":33.003},{"time":19.508,"pitch":33.621},{"time":19.517,"pitch":34.112},{"time":19.525,"pitch":34.501},{"time":19.533,"pitch":34.811},{"time":19.542,"pitch":35.056},{"time":19.550,"pitch":35.251},{"time":19.558,"pitch":35.405},{"time":19.567,"pitch":35.528},{"time":19.575,"pitch":35.625},{"time":19.583,"pitch":35.703},{"time":19.592,"pitch":35.764},{"time":19.600,"pitch":35.813},{"time":19.608,"pitch":35.851},{"time":19.617,"pitch":35.882},{"time":19.625,"pitch":35.906},{"time":19.633,"pitch":35.926},{"time":19.642,"pitch":35.941},{"time":19.650,"pitch":35.953},{"time":19.658,"pitch":35.963},{"time":19.667,"pitch":35.970},{"time":19.675,"pitch":35.977},{"time":19.683,"pitch":35.981},{"time":19.692,"pitch":35.985},{"time":19.700,"pitch":35.988},{"time":19.708,"pitch":35.991},{"time":19.717,"pitch":35.993},{"time":19.725,"pitch":35.994},{"time":19.733,"pitch":35.995},{"time":19.742,"pitch":35.996},{"time":19.750,"pitch":35.997},{"time":19.758,"pitch":35.998},{"time":19.775,"pitch":35.999},{"time":19.817,"pitch":36.000},{"time":20.000,"pitch":36.413},{"time":20.008,"pitch":36.740},{"time":20.017,"pitch":37.000},{"time":20.025,"pitch":37.206},{"time":20.033,"pitch":37.370},{"time":20.042,"pitch":37.500},{"time":20.050,"pitch":37.603},{"time":20.058,"pitch":37.685},{"time":20.067,"pitch":37.750},{"time":20.075,"pitch":37.802},{"time":20.083,"pitch":37.843},{"time":20.092,"pitch":37.875},{"time":20.100,"pitch":37.901},{"time":20.108,"pitch":37.921},{"time":20.117,"pitch":37.937},{"time":20.125,"pitch":37.950},{"time":20.133,"pitch":37.961},{"time":20.142,"pitch":37.969},{"time":20.150,"pitch":37.975},{"time":20.158,"pitch":37.980},{"time":20.167,"pitch":37.984},{"time":20.175,"pitch":37.988},{"time":20.183,"pitch":37.990},{"time":20.192,"pitch":37.992},{"time":20.200,"pitch":37.994},{"time":20.208,"pitch":37.995},{"time":20.217,"pitch":37.996},{"time":20.225,"pitch":37.997},{"time":20.233,"pitch":37.998},{"time":20.258,"pitch":37.999},{"time":20.292,"pitch":38.000},{"time":20.733,"pitch":38.619},{"time":20.742,"pitch":39.110},{"time":20.750,"pitch":39.500},{"time":20.758,"pitch":39.809},{"time":20.767,"pitch":40.055},{"time":20.775,"pitch":40.250},{"time":20.783,"pitch":40.405},{"time":20.792,"pitch":40.528},{"time":20.800,"pitch":40.625},{"time":20.808,"pitch":40.702},{"time":20.817,"pitch":40.764},{"time":20.825,"pitch":40.812},{"time":20.833,"pitch":40.851},{"time":20.842,"pitch":40.882},{"time":20.850,"pitch":40.906},{"time":20.858,"pitch":40.926},{"time":20.867,"pitch":40.941},{"time":20.875,"pitch":40.953},{"time":20.883,"pitch":40.963},{"time":20.892,"pitch":40.970},{"time":20.900,"pitch":40.977},{"time":20.908,"pitch":40.981},{"time":20.917,"pitch":40.985},{"time":20.925,"pitch":40.988},{"time":20.933,"pitch":40.991},{"time":20.942,"pitch":40.993},{"time":20.950,"pitch":40.994},{"time":20.958,"pitch":40.995},{"time":20.967,"pitch":40.996},{"time":20.975,"pitch":40.997},{"time":20.983,"pitch":40.998},{"time":21.000,"pitch":40.999},{"time":21.042,"pitch":41.000},{"time":21.258,"pitch":40.381},{"time":21.267,"pitch":39.890},{"time":21.275,"pitch":39.500},{"time":21.283,"pitch":39.191},{"time":21.292,"pitch":38.945},{"time":21.300,"pitch":38.750},{"time":21.308,"pitch":38.595},{"time":21.317,"pitch":38.472},{"time":21.325,"pitch":38.375},{"time":21.333,"pitch":38.298},{"time":21.342,"pitch":38.236},{"time":21.350,"pitch":38.187},{"time":21.358,"pitch":38.149},{"time":21.367,"pitch":38.118},{"time":21.375,"pitch":38.094},{"time":21.383,"pitch":38.074},{"time":21.392,"pitch":38.059},{"time":21.400,"pitch":38.047},{"time":21.408,"pitch":38.037},{"time":21.417,"pitch":38.030},{"time":21.425,"pitch":38.023},{"time":21.433,"pitch":38.019},{"time":21.442,"pitch":38.015},{"time":21.450,"pitch":38.012},{"time":21.458,"pitch":38.009},{"time":21.467,"pitch":38.007},{"time":21.475,"pitch":38.006},{"time":21.483,"pitch":38.005},{"time":21.492,"pitch":38.004},{"time":21.500,"pitch":38.622},{"time":21.508,"pitch":39.112},{"time":21.517,"pitch":39.502},{"time":21.525,"pitch":39.811},{"time":21.533,"pitch":40.056},{"time":21.542,"pitch":40.251},{"time":21.550,"pitch":40.405},{"time":21.558,"pitch":40.528},{"time":21.567,"pitch":40.625},{"time":21.575,"pitch":40.703},{"time":21.583,"pitch":40.764},{"time":21.592,"pitch":40.813},{"time":21.600,"pitch":40.851},{"time":21.608,"pitch":40.882},{"time":21.617,"pitch":40.906},{"time":21.625,"pitch":40.926},{"time":21.633,"pitch":40.941},{"time":21.642,"pitch":40.953},{"time":21.650,"pitch":40.963},{"time":21.658,"pitch":40.971},{"time":21.667,"pitch":40.977},{"time":21.675,"pitch":40.981},{"time":21.683,"pitch":40.985},{"time":21.692,"pitch":40.988},{"time":21.700,"pitch":40.991},{"time":21.708,"pitch":40.993},{"time":21.717,"pitch":40.994},{"time":21.725,"pitch":40.995},{"time":21.733,"pitch":40.996},{"time":21.742,"pitch":40.997},{"time":21.750,"pitch":40.998},{"time":21.767,"pitch":40.999},{"time":21.808,"pitch":41.000},{"time":22.008,"pitch":40.381},{"time":22.017,"pitch":39.890},{"time":22.025,"pitch":39.500},{"time":22.033,"pitch":39.191},{"time":22.042,"pitch":38.945},{"time":22.050,"pitch":38.750},{"time":22.058,"pitch":38.595},{"time":22.067,"pitch":38.472},{"time":22.075,"pitch":38.375},{"time":22.083,"pitch":38.298},{"time":22.092,"pitch":38.236},{"time":22.100,"pitch":38.187},{"time":22.108,"pitch":38.149},{"time":22.117,"pitch":38.118},{"time":22.125,"pitch":38.094},{"time":22.133,"pitch":38.074},{"time":22.142,"pitch":38.059},{"time":22.150,"pitch":38.047},{"time":22.158,"pitch":38.037},{"time":22.167,"pitch":38.030},{"time":22.175,"pitch":38.023},{"time":22.183,"pitch":38.019},{"time":22.192,"pitch":38.015},{"time":22.200,"pitch":38.012},{"time":22.208,"pitch":38.009},{"time":22.217,"pitch":38.007},{"time":22.225,"pitch":38.006},{"time":22.233,"pitch":38.005},{"time":22.242,"pitch":38.004},{"time":22.250,"pitch":38.003},{"time":22.258,"pitch":38.002},{"time":22.275,"pitch":38.001},{"time":22.317,"pitch":38.000},{"time":22.758,"pitch":37.587},{"time":22.767,"pitch":37.260},{"time":22.775,"pitch":37.000},{"time":22.783,"pitch":36.794},{"time":22.792,"pitch":36.630},{"time":22.800,"pitch":36.500},{"time":22.808,"pitch":36.397},{"time":22.817,"pitch":36.315},{"time":22.825,"pitch":36.250},{"time":22.833,"pitch":36.198},{"time":22.842,"pitch":36.157},{"time":22.850,"pitch":36.125},{"time":22.858,"pitch":36.099},{"time":22.867,"pitch":36.079},{"time":22.875,"pitch":36.063},{"time":22.883,"pitch":36.050},{"time":22.892,"pitch":36.039},{"time":22.900,"pitch":36.031},{"time":22.908,"pitch":36.025},{"time":22.917,"pitch":36.020},{"time":22.925,"pitch":36.016},{"time":22.933,"pitch":36.012},{"time":22.942,"pitch":36.010},{"time":22.950,"pitch":36.008},{"time":22.958,"pitch":36.006},{"time":22.967,"pitch":36.005},{"time":22.975,"pitch":36.004},{"time":22.983,"pitch":36.003},{"time":22.992,"pitch":36.002},{"time":23.017,"pitch":36.001},{"time":23.050,"pitch":36.000},{"time":23.258,"pitch":35.381},{"time":23.267,"pitch":34.890},{"time":23.275,"pitch":34.500},{"time":23.283,"pitch":34.191},{"time":23.292,"pitch":33.945},{"time":23.300,"pitch":33.750},{"time":23.308,"pitch":33.595},{"time":23.317,"pitch":33.472},{"time":23.325,"pitch":33.375},{"time":23.333,"pitch":33.298},{"time":23.342,"pitch":33.236},{"time":23.350,"pitch":33.188},{"time":23.358,"pitch":33.149},{"time":23.367,"pitch":33.118},{"time":23.375,"pitch":33.094},{"time":23.383,"pitch":33.074},{"time":23.392,"pitch":33.059},{"time":23.400,"pitch":33.047},{"time":23.408,"pitch":33.037},{"time":23.417,"pitch":33.030},{"time":23.425,"pitch":33.023},{"time":23.433,"pitch":33.019},{"time":23.442,"pitch":33.015},{"time":23.450,"pitch":33.012},{"time":23.458,"pitch":33.009},{"time":23.467,"pitch":33.007},{"time":23.475,"pitch":33.006},{"time":23.483,"pitch":33.005},{"time":23.492,"pitch":33.004},{"time":23.500,"pitch":33.003},{"time":23.508,"pitch":33.621},{"time":23.517,"pitch":34.112},{"time":23.525,"pitch":34.501},{"time":23.533,"pitch":34.811},{"time":23.542,"pitch":35.056},{"time":23.550,"pitch":35.251},{"time":23.558,"pitch":35.405},{"time":23.567,"pitch":35.528},{"time":23.575,"pitch":35.625},{"time":23.583,"pitch":35.703},{"time":23.592,"pitch":35.764},{"time":23.600,"pitch":35.813},{"time":23.608,"pitch":35.851},{"time":23.617,"pitch":35.882},{"time":23.625,"pitch":35.906},{"time":23.633,"pitch":35.926},{"time":23.642,"pitch":35.941},{"time":23.650,"pitch":35.953},{"time":23.658,"pitch":35.963},{"time":23.667,"pitch":35.970},{"time":23.675,"pitch":35.977},{"time":23.683,"pitch":35.981},{"time":23.692,"pitch":35.985},{"time":23.700,"pitch":35.988},{"time":23.708,"pitch":35.991},{"time":23.717,"pitch":35.993},{"time":23.725,"pitch":35.994},{"time":23.733,"pitch":35.995},{"time":23.742,"pitch":35.996},{"time":23.750,"pitch":35.997},{"time":23.758,"pitch":35.998},{"time":23.775,"pitch":35.999},{"time":23.817,"pitch":36.000},{"time":24.000,"pitch":36.413},{"time":24.008,"pitch":36.740},{"time":24.017,"pitch":37.000},{"time":24.025,"pitch":37.206},{"time":24.033,"pitch":37.370},{"time":24.042,"pitch":37.500},{"time":24.050,"pitch":37.603},{"time":24.058,"pitch":37.685},{"time":24.067,"pitch":37.750},{"time":24.075,"pitch":37.802},{"time":24.083,"pitch":37.843},{"time":24.092,"pitch":37.875},{"time":24.100,"pitch":37.901},{"time":24.108,"pitch":37.921},{"time":24.117,"pitch":37.937},{"time":24.125,"pitch":37.950},{"time":24.133,"pitch":37.961},{"time":24.142,"pitch":37.969},{"time":24.150,"pitch":37.975},{"time":24.158,"pitch":37.980},{"time":24.167,"pitch":37.984},{"time":24.175,"pitch":37.988},{"time":24.183,"pitch":37.990},{"time":24.192,"pitch":37.992},{"time":24.200,"pitch":37.994},{"time":24.208,"pitch":37.995},{"time":24.217,"pitch":37.996},{"time":24.225,"pitch":37.997},{"time":24.233,"pitch":37.998},{"time":24.258,"pitch":37.999},{"time":24.292,"pitch":38.000},{"time":24.733,"pitch":38.619},{"time":24.742,"pitch":39.110},{"time":24.750,"pitch":39.500},{"time":24.758,"pitch":39.809},{"time":24.767,"pitch":40.055},{"time":24.775,"pitch":40.250},{"time":24.783,"pitch":40.405},{"time":24.792,"pitch":40.528},{"time":24.800,"pitch":40.625},{"time":24.808,"pitch":40.702},{"time":24.817,"pitch":40.764},{"time":24.825,"pitch":40.812},{"time":24.833,"pitch":40.851},{"time":24.842,"pitch":40.882},{"time":24.850,"pitch":40.906},{"time":24.858,"pitch":40.926},{"time":24.867,"pitch":40.941},{"time":24.875,"pitch":40.953},{"time":24.883,"pitch":40.963},{"time":24.892,"pitch":40.970},{"time":24.900,"pitch":40.977},{"time":24.908,"pitch":40.981},{"time":24.917,"pitch":40.985},{"time":24.925,"pitch":40.988},{"time":24.933,"pitch":40.991},{"time":24.942,"pitch":40.993},{"time":24.950,"pitch":40.994},{"time":24.958,"pitch":40.995},{"time":24.967,"pitch":40.996},{"time":24.975,"pitch":40.997},{"time":24.983,"pitch":40.998},{"time":25.000,"pitch":40.999},{"time":25.042,"pitch":41.000},{"time":25.258,"pitch":40.381},{"time":25.267,"pitch":39.890},{"time":25.275,"pitch":39.500},{"time":25.283,"pitch":39.191},{"time":25.292,"pitch":38.945},{"time":25.300,"pitch":38.750},{"time":25.308,"pitch":38.595},{"time":25.317,"pitch":38.472},{"time":25.325,"pitch":38.375},{"time":25.333,"pitch":38.298},{"time":25.342,"pitch":38.236},{"time":25.350,"pitch":38.187},{"time":25.358,"pitch":38.149},{"time":25.367,"pitch":38.118},{"time":25.375,"pitch":38.094},{"time":25.383,"pitch":38.074},{"time":25.392,"pitch":38.059},{"time":25.400,"pitch":38.047},{"time":25.408,"pitch":38.037},{"time":25.417,"pitch":38.030},{"time":25.425,"pitch":38.023},{"time":25.433,"pitch":38.019},{"time":25.442,"pitch":38.015},{"time":25.450,"pitch":38.012},{"time":25.458,"pitch":38.009},{"time":25.467,"pitch":38.007},{"time":25.475,"pitch":38.006},{"time":25.483,"pitch":38.005},{"time":25.492,"pitch":38.004},{"time":25.500,"pitch":38.622},{"time":25.508,"pitch":39.112},{"time":25.517,"pitch":39.502},{"time":25.525,"pitch":39.811},{"time":25.533,"pitch":40.056},{"time":25.542,"pitch":40.251},{"time":25.550,"pitch":40.405},{"time":25.558,"pitch":40.528},{"time":25.567,"pitch":40.625},{"time":25.575,"pitch":40.703},{"time":25.583,"pitch":40.764},{"time":25.592,"pitch":40.813},{"time":25.600,"pitch":40.851},{"time":25.608,"pitch":40.882},{"time":25.617,"pitch":40.906},{"time":25.625,"pitch":40.926},{"time":25.633,"pitch":40.941},{"time":25.642,"pitch":40.953},{"time":25.650,"pitch":40.963},{"time":25.658,"pitch":40.971},{"time":25.667,"pitch":40.977},{"time":25.675,"pitch":40.981},{"time":25.683,"pitch":40.985},{"time":25.692,"pitch":40.988},{"time":25.700,"pitch":40.991},{"time":25.708,"pitch":40.993},{"time":25.717,"pitch":40.994},{"time":25.725,"pitch":40.995},{"time":25.733,"pitch":40.996},{"time":25.742,"pitch":40.997},{"time":25.750,"pitch":40.998},{"time":25.767,"pitch":40.999},{"time":25.808,"pitch":41.000},{"time":26.008,"pitch":40.381},{"time":26.017,"pitch":39.890},{"time":26.025,"pitch":39.500},{"time":26.033,"pitch":39.191},{"time":26.042,"pitch":38.945},{"time":26.050,"pitch":38.750},{"time":26.058,"pitch":38.595},{"time":26.067,"pitch":38.472},{"time":26.075,"pitch":38.375},{"time":26.083,"pitch":38.298},{"time":26.092,"pitch":38.236},{"time":26.100,"pitch":38.187},{"time":26.108,"pitch":38.149},{"time":26.117,"pitch":38.118},{"time":26.125,"pitch":38.094},{"time":26.133,"pitch":38.074},{"time":26.142,"pitch":38.059},{"time":26.150,"pitch":38.047},{"time":26.158,"pitch":38.037},{"time":26.167,"pitch":38.030},{"time":26.175,"pitch":38.023},{"time":26.183,"pitch":38.019},{"time":26.192,"pitch":38.015},{"time":26.200,"pitch":38.012},{"time":26.208,"pitch":38.009},{"time":26.217,"pitch":38.007},{"time":26.225,"pitch":38.006},{"time":26.233,"pitch":38.005},{"time":26.242,"pitch":38.004},{"time":26.250,"pitch":38.003},{"time":26.258,"pitch":38.002},{"time":26.275,"pitch":38.001},{"time":26.317,"pitch":38.000},{"time":26.758,"pitch":37.587},{"time":26.767,"pitch":37.260},{"time":26.775,"pitch":37.000},{"time":26.783,"pitch":36.794},{"time":26.792,"pitch":36.630},{"time":26.800,"pitch":36.500},{"time":26.808,"pitch":36.397},{"time":26.817,"pitch":36.315},{"time":26.825,"pitch":36.250},{"time":26.833,"pitch":36.198},{"time":26.842,"pitch":36.157},{"time":26.850,"pitch":36.125},{"time":26.858,"pitch":36.099},{"time":26.867,"pitch":36.079},{"time":26.875,"pitch":36.063},{"time":26.883,"pitch":36.050},{"time":26.892,"pitch":36.039},{"time":26.900,"pitch":36.031},{"time":26.908,"pitch":36.025},{"time":26.917,"pitch":36.020},{"time":26.925,"pitch":36.016},{"time":26.933,"pitch":36.012},{"time":26.942,"pitch":36.010},{"time":26.950,"pitch":36.008},{"time":26.958,"pitch":36.006},{"time":26.967,"pitch":36.005},{"time":26.975,"pitch":36.004},{"time":26.983,"pitch":36.003},{"time":26.992,"pitch":36.002},{"time":27.017,"pitch":36.001},{"time":27.050,"pitch":36.000},{"time":27.258,"pitch":35.381},{"time":27.267,"pitch":34.890},{"time":27.275,"pitch":34.500},{"time":27.283,"pitch":34.191},{"time":27.292,"pitch":33.945},{"time":27.300,"pitch":33.750},{"time":27.308,"pitch":33.595},{"time":27.317,"pitch":33.472},{"time":27.325,"pitch":33.375},{"time":27.333,"pitch":33.298},{"time":27.342,"pitch":33.236},{"time":27.350,"pitch":33.188},{"time":27.358,"pitch":33.149},{"time":27.367,"pitch":33.118},{"time":27.375,"pitch":33.094},{"time":27.383,"pitch":33.074},{"time":27.392,"pitch":33.059},{"time":27.400,"pitch":33.047},{"time":27.408,"pitch":33.037},{"time":27.417,"pitch":33.030},{"time":27.425,"pitch":33.023},{"time":27.433,"pitch":33.019},{"time":27.442,"pitch":33.015},{"time":27.450,"pitch":33.012},{"time":27.458,"pitch":33.009},{"time":27.467,"pitch":33.007},{"time":27.475,"pitch":33.006},{"time":27.483,"pitch":33.005},{"time":27.492,"pitch":33.004},{"time":27.500,"pitch":33.003},{"time":27.508,"pitch":33.621},{"time":27.517,"pitch":34.112},{"time":27.525,"pitch":34.501},{"time":27.533,"pitch":34.811},{"time":27.542,"pitch":35.056},{"time":27.550,"pitch":35.251},{"time":27.558,"pitch":35.405},{"time":27.567,"pitch":35.528},{"time":27.575,"pitch":35.625},{"time":27.583,"pitch":35.703},{"time":27.592,"pitch":35.764},{"time":27.600,"pitch":35.813},{"time":27.608,"pitch":35.851},{"time":27.617,"pitch":35.882},{"time":27.625,"pitch":35.906},{"time":27.633,"pitch":35.926},{"time":27.642,"pitch":35.941},{"time":27.650,"pitch":35.953},{"time":27.658,"pitch":35.963},{"time":27.667,"pitch":35.970},{"time":27.675,"pitch":35.977},{"time":27.683,"pitch":35.981},{"time":27.692,"pitch":35.985},{"time":27.700,"pitch":35.988},{"time":27.708,"pitch":35.991},{"time":27.717,"pitch":35.993},{"time":27.725,"pitch":35.994},{"time":27.733,"pitch":35.995},{"time":27.742,"pitch":35.996},{"time":27.750,"pitch":35.997},{"time":27.758,"pitch":35.998},{"time":27.775,"pitch":35.999},{"time":27.817,"pitch":36.000},{"time":28.000,"pitch":36.413},{"time":28.008,"pitch":36.740},{"time":28.017,"pitch":37.000},{"time":28.025,"pitch":37.206},{"time":28.033,"pitch":37.370},{"time":28.042,"pitch":37.500},{"time":28.050,"pitch":37.603},{"time":28.058,"pitch":37.685},{"time":28.067,"pitch":37.750},{"time":28.075,"pitch":37.802},{"time":28.083,"pitch":37.843},{"time":28.092,"pitch":37.875},{"time":28.100,"pitch":37.901},{"time":28.108,"pitch":37.921},{"time":28.117,"pitch":37.937},{"time":28.125,"pitch":37.950},{"time":28.133,"pitch":37.961},{"time":28.142,"pitch":37.969},{"time":28.150,"pitch":37.975},{"time":28.158,"pitch":37.980},{"time":28.167,"pitch":37.984},{"time":28.175,"pitch":37.988},{"time":28.183,"pitch":37.990},{"time":28.192,"pitch":37.992},{"time":28.200,"pitch":37.994},{"time":28.208,"pitch":37.995},{"time":28.217,"pitch":37.996},{"time":28.225,"pitch":37.997},{"time":28.233,"pitch":37.998},{"time":28.258,"pitch":37.999},{"time":28.292,"pitch":38.000},{"time":28.733,"pitch":38.619},{"time":28.742,"pitch":39.110},{"time":28.750,"pitch":39.500},{"time":28.758,"pitch":39.809},{"time":28.767,"pitch":40.055},{"time":28.775,"pitch":40.250},{"time":28.783,"pitch":40.405},{"time":28.792,"pitch":40.528},{"time":28.800,"pitch":40.625},{"time":28.808,"pitch":40.702},{"time":28.817,"pitch":40.764},{"time":28.825,"pitch":40.812},{"time":28.833,"pitch":40.851},{"time":28.842,"pitch":40.882},{"time":28.850,"pitch":40.906},{"time":28.858,"pitch":40.926},{"time":28.867,"pitch":40.941},{"time":28.875,"pitch":40.953},{"time":28.883,"pitch":40.963},{"time":28.892,"pitch":40.970},{"time":28.900,"pitch":40.977},{"time":28.908,"pitch":40.981},{"time":28.917,"pitch":40.985},{"time":28.925,"pitch":40.988},{"time":28.933,"pitch":40.991},{"time":28.942,"pitch":40.993},{"time":28.950,"pitch":40.994},{"time":28.958,"pitch":40.995},{"time":28.967,"pitch":40.996},{"time":28.975,"pitch":40.997},{"time":28.983,"pitch":40.998},{"time":29.000,"pitch":40.999},{"time":29.042,"pitch":41.000},{"time":29.258,"pitch":40.381},{"time":29.267,"pitch":39.890},{"time":29.275,"pitch":39.500},{"time":29.283,"pitch":39.191},{"time":29.292,"pitch":38.945},{"time":29.300,"pitch":38.750},{"time":29.308,"pitch":38.595},{"time":29.317,"pitch":38.472},{"time":29.325,"pitch":38.375},{"time":29.333,"pitch":38.298},{"time":29.342,"pitch":38.236},{"time":29.350,"pitch":38.187},{"time":29.358,"pitch":38.149},{"time":29.367,"pitch":38.118},{"time":29.375,"pitch":38.094},{"time":29.383,"pitch":38.074},{"time":29.392,"pitch":38.059},{"time":29.400,"pitch":38.047},{"time":29.408,"pitch":38.037},{"time":29.417,"pitch":38.030},{"time":29.425,"pitch":38.023},{"time":29.433,"pitch":38.019},{"time":29.442,"pitch":38.015},{"time":29.450,"pitch":38.012},{"time":29.458,"pitch":38.009},{"time":29.467,"pitch":38.007},{"time":29.475,"pitch":38.006},{"time":29.483,"pitch":38.005},{"time":29.492,"pitch":38.004},{"time":29.500,"pitch":38.622},{"time":29.508,"pitch":39.112},{"time":29.517,"pitch":39.502},{"time":29.525,"pitch":39.811},{"time":29.533,"pitch":40.056},{"time":29.542,"pitch":40.251},{"time":29.550,"pitch":40.405},{"time":29.558,"pitch":40.528},{"time":29.567,"pitch":40.625},{"time":29.575,"pitch":40.703},{"time":29.583,"pitch":40.764},{"time":29.592,"pitch":40.813},{"time":29.600,"pitch":40.851},{"time":29.608,"pitch":40.882},{"time":29.617,"pitch":40.906},{"time":29.625,"pitch":40.926},{"time":29.633,"pitch":40.941},{"time":29.642,"pitch":40.953},{"time":29.650,"pitch":40.963},{"time":29.658,"pitch":40.971},{"time":29.667,"pitch":40.977},{"time":29.675,"pitch":40.981},{"time":29.683,"pitch":40.985},{"time":29.692,"pitch":40.988},{"time":29.700,"pitch":40.991},{"time":29.708,"pitch":40.993},{"time":29.717,"pitch":40.994},{"time":29.725,"pitch":40.995},{"time":29.733,"pitch":40.996},{"time":29.742,"pitch":40.997},{"time":29.750,"pitch":40.998},{"time":29.767,"pitch":40.999},{"time":29.808,"pitch":41.000},{"time":30.008,"pitch":40.381},{"time":30.017,"pitch":39.890},{"time":30.025,"pitch":39.500},{"time":30.033,"pitch":39.191},{"time":30.042,"pitch":38.945},{"time":30.050,"pitch":38.750},{"time":30.058,"pitch":38.595},{"time":30.067,"pitch":38.472},{"time":30.075,"pitch":38.375},{"time":30.083,"pitch":38.298},{"time":30.092,"pitch":38.236},{"time":30.100,"pitch":38.187},{"time":30.108,"pitch":38.149},{"time":30.117,"pitch":38.118},{"time":30.125,"pitch":38.094},{"time":30.133,"pitch":38.074},{"time":30.142,"pitch":38.059},{"time":30.150,"pitch":38.047},{"time":30.158,"pitch":38.037},{"time":30.167,"pitch":38.030},{"time":30.175,"pitch":38.023},{"time":30.183,"pitch":38.019},{"time":30.192,"pitch":38.015},{"time":30.200,"pitch":38.012},{"time":30.208,"pitch":38.009},{"time":30.217,"pitch":38.007},{"time":30.225,"pitch":38.006},{"time":30.233,"pitch":38.005},{"time":30.242,"pitch":38.004},{"time":30.250,"pitch":38.003},{"time":30.258,"pitch":38.002},{"time":30.275,"pitch":38.001},{"time":30.317,"pitch":38.000},{"time":30.758,"pitch":37.587},{"time":30.767,"pitch":37.260},{"time":30.775,"pitch":37.000},{"time":30.783,"pitch":36.794},{"time":30.792,"pitch":36.630},{"time":30.800,"pitch":36.500},{"time":30.808,"pitch":36.397},{"time":30.817,"pitch":36.315},{"time":30.825,"pitch":36.250},{"time":30.833,"pitch":36.198},{"time":30.842,"pitch":36.157},{"time":30.850,"pitch":36.125},{"time":30.858,"pitch":36.099},{"time":30.867,"pitch":36.079},{"time":30.875,"pitch":36.063},{"time":30.883,"pitch":36.050},{"time":30.892,"pitch":36.039},{"time":30.900,"pitch":36.031},{"time":30.908,"pitch":36.025},{"time":30.917,"pitch":36.020},{"time":30.925,"pitch":36.016},{"time":30.933,"pitch":36.012},{"time":30.942,"pitch":36.010},{"time":30.950,"pitch":36.008},{"time":30.958,"pitch":36.006},{"time":30.967,"pitch":36.005},{"time":30.975,"pitch":36.004},{"time":30.983,"pitch":36.003},{"time":30.992,"pitch":36.002},{"time":31.017,"pitch":36.001},{"time":31.050,"pitch":36.000},{"time":31.258,"pitch":35.381},{"time":31.267,"pitch":34.890},{"time":31.275,"pitch":34.500},{"time":31.283,"pitch":34.191},{"time":31.292,"pitch":33.945},{"time":31.300,"pitch":33.750},{"time":31.308,"pitch":33.595},{"time":31.317,"pitch":33.472},{"time":31.325,"pitch":33.375},{"time":31.333,"pitch":33.298},{"time":31.342,"pitch":33.236},{"time":31.350,"pitch":33.188},{"time":31.358,"pitch":33.149},{"time":31.367,"pitch":33.118},{"time":31.375,"pitch":33.094},{"time":31.383,"pitch":33.074},{"time":31.392,"pitch":33.059},{"time":31.400,"pitch":33.047},{"time":31.408,"pitch":33.037},{"time":31.417,"pitch":33.030},{"time":31.425,"pitch":33.023},{"time":31.433,"pitch":33.019},{"time":31.442,"pitch":33.015},{"time":31.450,"pitch":33.012},{"time":31.458,"pitch":33.009},{"time":31.467,"pitch":33.007},{"time":31.475,"pitch":33.006},{"time":31.483,"pitch":33.005},{"time":31.492,"pitch":33.004},{"time":31.500,"pitch":33.003},{"time":31.508,"pitch":33.621},{"time":31.517,"pitch":34.112},{"time":31.525,"pitch":34.501},{"time":31.533,"pitch":34.811},{"time":31.542,"pitch":35.056},{"time":31.550,"pitch":35.251},{"time":31.558,"pitch":35.405},{"time":31.567,"pitch":35.528},{"time":31.575,"pitch":35.625},{"time":31.583,"pitch":35.703},{"time":31.592,"pitch":35.764},{"time":31.600,"pitch":35.813},{"time":31.608,"pitch":35.851},{"time":31.617,"pitch":35.882},{"time":31.625,"pitch":35.906},{"time":31.633,"pitch":35.926},{"time":31.642,"pitch":35.941},{"time":31.650,"pitch":35.953},{"time":31.658,"pitch":35.963},{"time":31.667,"pitch":35.970},{"time":31.675,"pitch":35.977},{"time":31.683,"pitch":35.981},{"time":31.692,"pitch":35.985},{"time":31.700,"pitch":35.988},{"time":31.708,"pitch":35.991},{"time":31.717,"pitch":35.993},{"time":31.725,"pitch":35.994},{"time":31.733,"pitch":35.995},{"time":31.742,"pitch":35.996},{"time":31.750,"pitch":35.997},{"time":31.758,"pitch":35.998},{"time":31.775,"pitch":35.999},{"time":31.817,"pitch":36.000},{"time":32.000,"pitch":36.413},{"time":32.008,"pitch":36.740},{"time":32.017,"pitch":37.000},{"time":32.025,"pitch":37.206},{"time":32.033,"pitch":37.370},{"time":32.042,"pitch":37.500},{"time":32.050,"pitch":37.603},{"time":32.058,"pitch":37.685},{"time":32.067,"pitch":37.750},{"time":32.075,"pitch":37.802},{"time":32.083,"pitch":37.843},{"time":32.092,"pitch":37.875},{"time":32.100,"pitch":37.901},{"time":32.108,"pitch":37.921},{"time":32.117,"pitch":37.937},{"time":32.125,"pitch":37.950},{"time":32.133,"pitch":37.961},{"time":32.142,"pitch":37.969},{"time":32.150,"pitch":37.975},{"time":32.158,"pitch":37.980},{"time":32.167,"pitch":37.984},{"time":32.175,"pitch":37.988},{"time":32.183,"pitch":37.990},{"time":32.192,"pitch":37.992},{"time":32.200,"pitch":37.994},{"time":32.208,"pitch":37.995},{"time":32.217,"pitch":37.996},{"time":32.225,"pitch":37.997},{"time":32.233,"pitch":37.998},{"time":32.258,"pitch":37.999},{"time":32.292,"pitch":38.000},{"time":32.317,"volume":0.833},{"time":32.325,"volume":0.667},{"time":32.333,"volume":0.500},{"time":32.342,"volume":0.333},{"time":32.350,"volume":0.167},{"time":32.358,"volume":0.000},{"time":32.367,"volume":0}]}},{"noteOn":{"time":63.000,"k":[{"time":0.000,"pitch":38.000,"volume":0.167},{"time":0.008,"pitch":38.000,"volume":0.333},{"time":0.017,"volume":0.500},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1.000},{"time":0.733,"pitch":38.619},{"time":0.742,"pitch":39.110},{"time":0.750,"pitch":39.500},{"time":0.758,"pitch":39.809},{"time":0.767,"pitch":40.055},{"time":0.775,"pitch":40.250},{"time":0.783,"pitch":40.405},{"time":0.792,"pitch":40.528},{"time":0.800,"pitch":40.625},{"time":0.808,"pitch":40.702},{"time":0.817,"pitch":40.764},{"time":0.825,"pitch":40.813},{"time":0.833,"pitch":40.851},{"time":0.842,"pitch":40.882},{"time":0.850,"pitch":40.906},{"time":0.858,"pitch":40.926},{"time":0.867,"pitch":40.941},{"time":0.875,"pitch":40.953},{"time":0.883,"pitch":40.963},{"time":0.892,"pitch":40.970},{"time":0.900,"pitch":40.977},{"time":0.908,"pitch":40.981},{"time":0.917,"pitch":40.985},{"time":0.925,"pitch":40.988},{"time":0.933,"pitch":40.991},{"time":0.942,"pitch":40.993},{"time":0.950,"pitch":40.994},{"time":0.958,"pitch":40.995},{"time":0.967,"pitch":40.996},{"time":0.975,"pitch":40.997},{"time":0.983,"pitch":40.998},{"time":1.000,"pitch":40.999},{"time":1.042,"pitch":41.000},{"time":1.258,"pitch":40.381},{"time":1.267,"pitch":39.890},{"time":1.275,"pitch":39.500},{"time":1.283,"pitch":39.191},{"time":1.292,"pitch":38.945},{"time":1.300,"pitch":38.750},{"time":1.308,"pitch":38.595},{"time":1.317,"pitch":38.472},{"time":1.325,"pitch":38.375},{"time":1.333,"pitch":38.298},{"time":1.342,"pitch":38.236},{"time":1.350,"pitch":38.187},{"time":1.358,"pitch":38.149},{"time":1.367,"pitch":38.118},{"time":1.375,"pitch":38.094},{"time":1.383,"pitch":38.074},{"time":1.392,"pitch":38.059},{"time":1.400,"pitch":38.047},{"time":1.408,"pitch":38.037},{"time":1.417,"pitch":38.030},{"time":1.425,"pitch":38.023},{"time":1.433,"pitch":38.019},{"time":1.442,"pitch":38.015},{"time":1.450,"pitch":38.012},{"time":1.458,"pitch":38.009},{"time":1.467,"pitch":38.007},{"time":1.475,"pitch":38.006},{"time":1.483,"pitch":38.005},{"time":1.492,"pitch":38.004},{"time":1.500,"pitch":38.622},{"time":1.508,"pitch":39.112},{"time":1.517,"pitch":39.502},{"time":1.525,"pitch":39.811},{"time":1.533,"pitch":40.056},{"time":1.542,"pitch":40.251},{"time":1.550,"pitch":40.405},{"time":1.558,"pitch":40.528},{"time":1.567,"pitch":40.625},{"time":1.575,"pitch":40.703},{"time":1.583,"pitch":40.764},{"time":1.592,"pitch":40.813},{"time":1.600,"pitch":40.851},{"time":1.608,"pitch":40.882},{"time":1.617,"pitch":40.906},{"time":1.625,"pitch":40.926},{"time":1.633,"pitch":40.941},{"time":1.642,"pitch":40.953},{"time":1.650,"pitch":40.963},{"time":1.658,"pitch":40.971},{"time":1.667,"pitch":40.977},{"time":1.675,"pitch":40.981},{"time":1.683,"pitch":40.985},{"time":1.692,"pitch":40.988},{"time":1.700,"pitch":40.991},{"time":1.708,"pitch":40.993},{"time":1.717,"pitch":40.994},{"time":1.725,"pitch":40.995},{"time":1.733,"pitch":40.996},{"time":1.742,"pitch":40.997},{"time":1.750,"pitch":40.998},{"time":1.767,"pitch":40.999},{"time":1.808,"pitch":41.000},{"time":2.008,"pitch":40.381},{"time":2.017,"pitch":39.890},{"time":2.025,"pitch":39.500},{"time":2.033,"pitch":39.191},{"time":2.042,"pitch":38.945},{"time":2.050,"pitch":38.750},{"time":2.058,"pitch":38.595},{"time":2.067,"pitch":38.472},{"time":2.075,"pitch":38.375},{"time":2.083,"pitch":38.298},{"time":2.092,"pitch":38.236},{"time":2.100,"pitch":38.187},{"time":2.108,"pitch":38.149},{"time":2.117,"pitch":38.118},{"time":2.125,"pitch":38.094},{"time":2.133,"pitch":38.074},{"time":2.142,"pitch":38.059},{"time":2.150,"pitch":38.047},{"time":2.158,"pitch":38.037},{"time":2.167,"pitch":38.030},{"time":2.175,"pitch":38.023},{"time":2.183,"pitch":38.019},{"time":2.192,"pitch":38.015},{"time":2.200,"pitch":38.012},{"time":2.208,"pitch":38.009},{"time":2.217,"pitch":38.007},{"time":2.225,"pitch":38.006},{"time":2.233,"pitch":38.005},{"time":2.242,"pitch":38.004},{"time":2.250,"pitch":38.003},{"time":2.258,"pitch":38.002},{"time":2.275,"pitch":38.001},{"time":2.317,"pitch":38.000},{"time":2.758,"pitch":37.587},{"time":2.767,"pitch":37.260},{"time":2.775,"pitch":37.000},{"time":2.783,"pitch":36.794},{"time":2.792,"pitch":36.630},{"time":2.800,"pitch":36.500},{"time":2.808,"pitch":36.397},{"time":2.817,"pitch":36.315},{"time":2.825,"pitch":36.250},{"time":2.833,"pitch":36.198},{"time":2.842,"pitch":36.157},{"time":2.850,"pitch":36.125},{"time":2.858,"pitch":36.099},{"time":2.867,"pitch":36.079},{"time":2.875,"pitch":36.063},{"time":2.883,"pitch":36.050},{"time":2.892,"pitch":36.039},{"time":2.900,"pitch":36.031},{"time":2.908,"pitch":36.025},{"time":2.917,"pitch":36.020},{"time":2.925,"pitch":36.016},{"time":2.933,"pitch":36.012},{"time":2.942,"pitch":36.010},{"time":2.950,"pitch":36.008},{"time":2.958,"pitch":36.006},{"time":2.967,"pitch":36.005},{"time":2.975,"pitch":36.004},{"time":2.983,"pitch":36.003},{"time":2.992,"pitch":36.002},{"time":3.017,"pitch":36.001},{"time":3.050,"pitch":36.000},{"time":3.258,"pitch":35.381},{"time":3.267,"pitch":34.890},{"time":3.275,"pitch":34.500},{"time":3.283,"pitch":34.191},{"time":3.292,"pitch":33.945},{"time":3.300,"pitch":33.750},{"time":3.308,"pitch":33.595},{"time":3.317,"pitch":33.472},{"time":3.325,"pitch":33.375},{"time":3.333,"pitch":33.298},{"time":3.342,"pitch":33.236},{"time":3.350,"pitch":33.188},{"time":3.358,"pitch":33.149},{"time":3.367,"pitch":33.118},{"time":3.375,"pitch":33.094},{"time":3.383,"pitch":33.074},{"time":3.392,"pitch":33.059},{"time":3.400,"pitch":33.047},{"time":3.408,"pitch":33.037},{"time":3.417,"pitch":33.030},{"time":3.425,"pitch":33.023},{"time":3.433,"pitch":33.019},{"time":3.442,"pitch":33.015},{"time":3.450,"pitch":33.012},{"time":3.458,"pitch":33.009},{"time":3.467,"pitch":33.007},{"time":3.475,"pitch":33.006},{"time":3.483,"pitch":33.005},{"time":3.492,"pitch":33.004},{"time":3.500,"pitch":33.003},{"time":3.508,"pitch":33.621},{"time":3.517,"pitch":34.112},{"time":3.525,"pitch":34.501},{"time":3.533,"pitch":34.811},{"time":3.542,"pitch":35.056},{"time":3.550,"pitch":35.251},{"time":3.558,"pitch":35.405},{"time":3.567,"pitch":35.528},{"time":3.575,"pitch":35.625},{"time":3.583,"pitch":35.703},{"time":3.592,"pitch":35.764},{"time":3.600,"pitch":35.813},{"time":3.608,"pitch":35.851},{"time":3.617,"pitch":35.882},{"time":3.625,"pitch":35.906},{"time":3.633,"pitch":35.926},{"time":3.642,"pitch":35.941},{"time":3.650,"pitch":35.953},{"time":3.658,"pitch":35.963},{"time":3.667,"pitch":35.970},{"time":3.675,"pitch":35.977},{"time":3.683,"pitch":35.981},{"time":3.692,"pitch":35.985},{"time":3.700,"pitch":35.988},{"time":3.708,"pitch":35.991},{"time":3.717,"pitch":35.993},{"time":3.725,"pitch":35.994},{"time":3.733,"pitch":35.995},{"time":3.742,"pitch":35.996},{"time":3.750,"pitch":35.997},{"time":3.758,"pitch":35.998},{"time":3.775,"pitch":35.999},{"time":3.817,"pitch":36.000},{"time":4.000,"pitch":36.413},{"time":4.008,"pitch":36.740},{"time":4.017,"pitch":37.000},{"time":4.025,"pitch":37.206},{"time":4.033,"pitch":37.370},{"time":4.042,"pitch":37.500},{"time":4.050,"pitch":37.603},{"time":4.058,"pitch":37.685},{"time":4.067,"pitch":37.750},{"time":4.075,"pitch":37.802},{"time":4.083,"pitch":37.843},{"time":4.092,"pitch":37.875},{"time":4.100,"pitch":37.901},{"time":4.108,"pitch":37.921},{"time":4.117,"pitch":37.937},{"time":4.125,"pitch":37.950},{"time":4.133,"pitch":37.961},{"time":4.142,"pitch":37.969},{"time":4.150,"pitch":37.975},{"time":4.158,"pitch":37.980},{"time":4.167,"pitch":37.984},{"time":4.175,"pitch":37.988},{"time":4.183,"pitch":37.990},{"time":4.192,"pitch":37.992},{"time":4.200,"pitch":37.994},{"time":4.208,"pitch":37.995},{"time":4.217,"pitch":37.996},{"time":4.225,"pitch":37.997},{"time":4.233,"pitch":37.998},{"time":4.258,"pitch":37.999},{"time":4.292,"pitch":38.000},{"time":4.733,"pitch":38.619},{"time":4.742,"pitch":39.110},{"time":4.750,"pitch":39.500},{"time":4.758,"pitch":39.809},{"time":4.767,"pitch":40.055},{"time":4.775,"pitch":40.250},{"time":4.783,"pitch":40.405},{"time":4.792,"pitch":40.528},{"time":4.800,"pitch":40.625},{"time":4.808,"pitch":40.702},{"time":4.817,"pitch":40.764},{"time":4.825,"pitch":40.812},{"time":4.833,"pitch":40.851},{"time":4.842,"pitch":40.882},{"time":4.850,"pitch":40.906},{"time":4.858,"pitch":40.926},{"time":4.867,"pitch":40.941},{"time":4.875,"pitch":40.953},{"time":4.883,"pitch":40.963},{"time":4.892,"pitch":40.970},{"time":4.900,"pitch":40.977},{"time":4.908,"pitch":40.981},{"time":4.917,"pitch":40.985},{"time":4.925,"pitch":40.988},{"time":4.933,"pitch":40.991},{"time":4.942,"pitch":40.993},{"time":4.950,"pitch":40.994},{"time":4.958,"pitch":40.995},{"time":4.967,"pitch":40.996},{"time":4.975,"pitch":40.997},{"time":4.983,"pitch":40.998},{"time":5.000,"pitch":40.999},{"time":5.042,"pitch":41.000},{"time":5.258,"pitch":40.381},{"time":5.267,"pitch":39.890},{"time":5.275,"pitch":39.500},{"time":5.283,"pitch":39.191},{"time":5.292,"pitch":38.945},{"time":5.300,"pitch":38.750},{"time":5.308,"pitch":38.595},{"time":5.317,"pitch":38.472},{"time":5.325,"pitch":38.375},{"time":5.333,"pitch":38.298},{"time":5.342,"pitch":38.236},{"time":5.350,"pitch":38.187},{"time":5.358,"pitch":38.149},{"time":5.367,"pitch":38.118},{"time":5.375,"pitch":38.094},{"time":5.383,"pitch":38.074},{"time":5.392,"pitch":38.059},{"time":5.400,"pitch":38.047},{"time":5.408,"pitch":38.037},{"time":5.417,"pitch":38.030},{"time":5.425,"pitch":38.023},{"time":5.433,"pitch":38.019},{"time":5.442,"pitch":38.015},{"time":5.450,"pitch":38.012},{"time":5.458,"pitch":38.009},{"time":5.467,"pitch":38.007},{"time":5.475,"pitch":38.006},{"time":5.483,"pitch":38.005},{"time":5.492,"pitch":38.004},{"time":5.500,"pitch":38.622},{"time":5.508,"pitch":39.112},{"time":5.517,"pitch":39.502},{"time":5.525,"pitch":39.811},{"time":5.533,"pitch":40.056},{"time":5.542,"pitch":40.251},{"time":5.550,"pitch":40.405},{"time":5.558,"pitch":40.528},{"time":5.567,"pitch":40.625},{"time":5.575,"pitch":40.703},{"time":5.583,"pitch":40.764},{"time":5.592,"pitch":40.813},{"time":5.600,"pitch":40.851},{"time":5.608,"pitch":40.882},{"time":5.617,"pitch":40.906},{"time":5.625,"pitch":40.926},{"time":5.633,"pitch":40.941},{"time":5.642,"pitch":40.953},{"time":5.650,"pitch":40.963},{"time":5.658,"pitch":40.971},{"time":5.667,"pitch":40.977},{"time":5.675,"pitch":40.981},{"time":5.683,"pitch":40.985},{"time":5.692,"pitch":40.988},{"time":5.700,"pitch":40.991},{"time":5.708,"pitch":40.993},{"time":5.717,"pitch":40.994},{"time":5.725,"pitch":40.995},{"time":5.733,"pitch":40.996},{"time":5.742,"pitch":40.997},{"time":5.750,"pitch":40.998},{"time":5.767,"pitch":40.999},{"time":5.808,"pitch":41.000},{"time":6.008,"pitch":40.381},{"time":6.017,"pitch":39.890},{"time":6.025,"pitch":39.500},{"time":6.033,"pitch":39.191},{"time":6.042,"pitch":38.945},{"time":6.050,"pitch":38.750},{"time":6.058,"pitch":38.595},{"time":6.067,"pitch":38.472},{"time":6.075,"pitch":38.375},{"time":6.083,"pitch":38.298},{"time":6.092,"pitch":38.236},{"time":6.100,"pitch":38.187},{"time":6.108,"pitch":38.149},{"time":6.117,"pitch":38.118},{"time":6.125,"pitch":38.094},{"time":6.133,"pitch":38.074},{"time":6.142,"pitch":38.059},{"time":6.150,"pitch":38.047},{"time":6.158,"pitch":38.037},{"time":6.167,"pitch":38.030},{"time":6.175,"pitch":38.023},{"time":6.183,"pitch":38.019},{"time":6.192,"pitch":38.015},{"time":6.200,"pitch":38.012},{"time":6.208,"pitch":38.009},{"time":6.217,"pitch":38.007},{"time":6.225,"pitch":38.006},{"time":6.233,"pitch":38.005},{"time":6.242,"pitch":38.004},{"time":6.250,"pitch":38.003},{"time":6.258,"pitch":38.002},{"time":6.275,"pitch":38.001},{"time":6.317,"pitch":38.000},{"time":6.758,"pitch":37.587},{"time":6.767,"pitch":37.260},{"time":6.775,"pitch":37.000},{"time":6.783,"pitch":36.794},{"time":6.792,"pitch":36.630},{"time":6.800,"pitch":36.500},{"time":6.808,"pitch":36.397},{"time":6.817,"pitch":36.315},{"time":6.825,"pitch":36.250},{"time":6.833,"pitch":36.198},{"time":6.842,"pitch":36.157},{"time":6.850,"pitch":36.125},{"time":6.858,"pitch":36.099},{"time":6.867,"pitch":36.079},{"time":6.875,"pitch":36.063},{"time":6.883,"pitch":36.050},{"time":6.892,"pitch":36.039},{"time":6.900,"pitch":36.031},{"time":6.908,"pitch":36.025},{"time":6.917,"pitch":36.020},{"time":6.925,"pitch":36.016},{"time":6.933,"pitch":36.012},{"time":6.942,"pitch":36.010},{"time":6.950,"pitch":36.008},{"time":6.958,"pitch":36.006},{"time":6.967,"pitch":36.005},{"time":6.975,"pitch":36.004},{"time":6.983,"pitch":36.003},{"time":6.992,"pitch":36.002},{"time":7.017,"pitch":36.001},{"time":7.050,"pitch":36.000},{"time":7.258,"pitch":35.381},{"time":7.267,"pitch":34.890},{"time":7.275,"pitch":34.500},{"time":7.283,"pitch":34.191},{"time":7.292,"pitch":33.945},{"time":7.300,"pitch":33.750},{"time":7.308,"pitch":33.595},{"time":7.317,"pitch":33.472},{"time":7.325,"pitch":33.375},{"time":7.333,"pitch":33.298},{"time":7.342,"pitch":33.236},{"time":7.350,"pitch":33.188},{"time":7.358,"pitch":33.149},{"time":7.367,"pitch":33.118},{"time":7.375,"pitch":33.094},{"time":7.383,"pitch":33.074},{"time":7.392,"pitch":33.059},{"time":7.400,"pitch":33.047},{"time":7.408,"pitch":33.037},{"time":7.417,"pitch":33.030},{"time":7.425,"pitch":33.023},{"time":7.433,"pitch":33.019},{"time":7.442,"pitch":33.015},{"time":7.450,"pitch":33.012},{"time":7.458,"pitch":33.009},{"time":7.467,"pitch":33.007},{"time":7.475,"pitch":33.006},{"time":7.483,"pitch":33.005},{"time":7.492,"pitch":33.004},{"time":7.500,"pitch":33.003},{"time":7.508,"pitch":33.621},{"time":7.517,"pitch":34.112},{"time":7.525,"pitch":34.501},{"time":7.533,"pitch":34.811},{"time":7.542,"pitch":35.056},{"time":7.550,"pitch":35.251},{"time":7.558,"pitch":35.405},{"time":7.567,"pitch":35.528},{"time":7.575,"pitch":35.625},{"time":7.583,"pitch":35.703},{"time":7.592,"pitch":35.764},{"time":7.600,"pitch":35.813},{"time":7.608,"pitch":35.851},{"time":7.617,"pitch":35.882},{"time":7.625,"pitch":35.906},{"time":7.633,"pitch":35.926},{"time":7.642,"pitch":35.941},{"time":7.650,"pitch":35.953},{"time":7.658,"pitch":35.963},{"time":7.667,"pitch":35.970},{"time":7.675,"pitch":35.977},{"time":7.683,"pitch":35.981},{"time":7.692,"pitch":35.985},{"time":7.700,"pitch":35.988},{"time":7.708,"pitch":35.991},{"time":7.717,"pitch":35.993},{"time":7.725,"pitch":35.994},{"time":7.733,"pitch":35.995},{"time":7.742,"pitch":35.996},{"time":7.750,"pitch":35.997},{"time":7.758,"pitch":35.998},{"time":7.775,"pitch":35.999},{"time":7.817,"pitch":36.000},{"time":8.000,"pitch":36.413},{"time":8.008,"pitch":36.740},{"time":8.017,"pitch":37.000},{"time":8.025,"pitch":37.206},{"time":8.033,"pitch":37.370},{"time":8.042,"pitch":37.500},{"time":8.050,"pitch":37.603},{"time":8.058,"pitch":37.685},{"time":8.067,"pitch":37.750},{"time":8.075,"pitch":37.802},{"time":8.083,"pitch":37.843},{"time":8.092,"pitch":37.875},{"time":8.100,"pitch":37.901},{"time":8.108,"pitch":37.921},{"time":8.117,"pitch":37.937},{"time":8.125,"pitch":37.950},{"time":8.133,"pitch":37.961},{"time":8.142,"pitch":37.969},{"time":8.150,"pitch":37.975},{"time":8.158,"pitch":37.980},{"time":8.167,"pitch":37.984},{"time":8.175,"pitch":37.988},{"time":8.183,"pitch":37.990},{"time":8.192,"pitch":37.992},{"time":8.200,"pitch":37.994},{"time":8.208,"pitch":37.995},{"time":8.217,"pitch":37.996},{"time":8.225,"pitch":37.997},{"time":8.233,"pitch":37.998},{"time":8.258,"pitch":37.999},{"time":8.292,"pitch":38.000},{"time":8.733,"pitch":38.619},{"time":8.742,"pitch":39.110},{"time":8.750,"pitch":39.500},{"time":8.758,"pitch":39.809},{"time":8.767,"pitch":40.055},{"time":8.775,"pitch":40.250},{"time":8.783,"pitch":40.405},{"time":8.792,"pitch":40.528},{"time":8.800,"pitch":40.625},{"time":8.808,"pitch":40.702},{"time":8.817,"pitch":40.764},{"time":8.825,"pitch":40.812},{"time":8.833,"pitch":40.851},{"time":8.842,"pitch":40.882},{"time":8.850,"pitch":40.906},{"time":8.858,"pitch":40.926},{"time":8.867,"pitch":40.941},{"time":8.875,"pitch":40.953},{"time":8.883,"pitch":40.963},{"time":8.892,"pitch":40.970},{"time":8.900,"pitch":40.977},{"time":8.908,"pitch":40.981},{"time":8.917,"pitch":40.985},{"time":8.925,"pitch":40.988},{"time":8.933,"pitch":40.991},{"time":8.942,"pitch":40.993},{"time":8.950,"pitch":40.994},{"time":8.958,"pitch":40.995},{"time":8.967,"pitch":40.996},{"time":8.975,"pitch":40.997},{"time":8.983,"pitch":40.998},{"time":9.000,"pitch":40.999},{"time":9.042,"pitch":41.000},{"time":9.258,"pitch":40.381},{"time":9.267,"pitch":39.890},{"time":9.275,"pitch":39.500},{"time":9.283,"pitch":39.191},{"time":9.292,"pitch":38.945},{"time":9.300,"pitch":38.750},{"time":9.308,"pitch":38.595},{"time":9.317,"pitch":38.472},{"time":9.325,"pitch":38.375},{"time":9.333,"pitch":38.298},{"time":9.342,"pitch":38.236},{"time":9.350,"pitch":38.187},{"time":9.358,"pitch":38.149},{"time":9.367,"pitch":38.118},{"time":9.375,"pitch":38.094},{"time":9.383,"pitch":38.074},{"time":9.392,"pitch":38.059},{"time":9.400,"pitch":38.047},{"time":9.408,"pitch":38.037},{"time":9.417,"pitch":38.030},{"time":9.425,"pitch":38.023},{"time":9.433,"pitch":38.019},{"time":9.442,"pitch":38.015},{"time":9.450,"pitch":38.012},{"time":9.458,"pitch":38.009},{"time":9.467,"pitch":38.007},{"time":9.475,"pitch":38.006},{"time":9.483,"pitch":38.005},{"time":9.492,"pitch":38.004},{"time":9.500,"pitch":38.622},{"time":9.508,"pitch":39.112},{"time":9.517,"pitch":39.502},{"time":9.525,"pitch":39.811},{"time":9.533,"pitch":40.056},{"time":9.542,"pitch":40.251},{"time":9.550,"pitch":40.405},{"time":9.558,"pitch":40.528},{"time":9.567,"pitch":40.625},{"time":9.575,"pitch":40.703},{"time":9.583,"pitch":40.764},{"time":9.592,"pitch":40.813},{"time":9.600,"pitch":40.851},{"time":9.608,"pitch":40.882},{"time":9.617,"pitch":40.906},{"time":9.625,"pitch":40.926},{"time":9.633,"pitch":40.941},{"time":9.642,"pitch":40.953},{"time":9.650,"pitch":40.963},{"time":9.658,"pitch":40.971},{"time":9.667,"pitch":40.977},{"time":9.675,"pitch":40.981},{"time":9.683,"pitch":40.985},{"time":9.692,"pitch":40.988},{"time":9.700,"pitch":40.991},{"time":9.708,"pitch":40.993},{"time":9.717,"pitch":40.994},{"time":9.725,"pitch":40.995},{"time":9.733,"pitch":40.996},{"time":9.742,"pitch":40.997},{"time":9.750,"pitch":40.998},{"time":9.767,"pitch":40.999},{"time":9.808,"pitch":41.000},{"time":10.008,"pitch":40.381},{"time":10.017,"pitch":39.890},{"time":10.025,"pitch":39.500},{"time":10.033,"pitch":39.191},{"time":10.042,"pitch":38.945},{"time":10.050,"pitch":38.750},{"time":10.058,"pitch":38.595},{"time":10.067,"pitch":38.472},{"time":10.075,"pitch":38.375},{"time":10.083,"pitch":38.298},{"time":10.092,"pitch":38.236},{"time":10.100,"pitch":38.187},{"time":10.108,"pitch":38.149},{"time":10.117,"pitch":38.118},{"time":10.125,"pitch":38.094},{"time":10.133,"pitch":38.074},{"time":10.142,"pitch":38.059},{"time":10.150,"pitch":38.047},{"time":10.158,"pitch":38.037},{"time":10.167,"pitch":38.030},{"time":10.175,"pitch":38.023},{"time":10.183,"pitch":38.019},{"time":10.192,"pitch":38.015},{"time":10.200,"pitch":38.012},{"time":10.208,"pitch":38.009},{"time":10.217,"pitch":38.007},{"time":10.225,"pitch":38.006},{"time":10.233,"pitch":38.005},{"time":10.242,"pitch":38.004},{"time":10.250,"pitch":38.003},{"time":10.258,"pitch":38.002},{"time":10.275,"pitch":38.001},{"time":10.317,"pitch":38.000},{"time":10.758,"pitch":37.587},{"time":10.767,"pitch":37.260},{"time":10.775,"pitch":37.000},{"time":10.783,"pitch":36.794},{"time":10.792,"pitch":36.630},{"time":10.800,"pitch":36.500},{"time":10.808,"pitch":36.397},{"time":10.817,"pitch":36.315},{"time":10.825,"pitch":36.250},{"time":10.833,"pitch":36.198},{"time":10.842,"pitch":36.157},{"time":10.850,"pitch":36.125},{"time":10.858,"pitch":36.099},{"time":10.867,"pitch":36.079},{"time":10.875,"pitch":36.063},{"time":10.883,"pitch":36.050},{"time":10.892,"pitch":36.039},{"time":10.900,"pitch":36.031},{"time":10.908,"pitch":36.025},{"time":10.917,"pitch":36.020},{"time":10.925,"pitch":36.016},{"time":10.933,"pitch":36.012},{"time":10.942,"pitch":36.010},{"time":10.950,"pitch":36.008},{"time":10.958,"pitch":36.006},{"time":10.967,"pitch":36.005},{"time":10.975,"pitch":36.004},{"time":10.983,"pitch":36.003},{"time":10.992,"pitch":36.002},{"time":11.017,"pitch":36.001},{"time":11.050,"pitch":36.000},{"time":11.258,"pitch":35.381},{"time":11.267,"pitch":34.890},{"time":11.275,"pitch":34.500},{"time":11.283,"pitch":34.191},{"time":11.292,"pitch":33.945},{"time":11.300,"pitch":33.750},{"time":11.308,"pitch":33.595},{"time":11.317,"pitch":33.472},{"time":11.325,"pitch":33.375},{"time":11.333,"pitch":33.298},{"time":11.342,"pitch":33.236},{"time":11.350,"pitch":33.188},{"time":11.358,"pitch":33.149},{"time":11.367,"pitch":33.118},{"time":11.375,"pitch":33.094},{"time":11.383,"pitch":33.074},{"time":11.392,"pitch":33.059},{"time":11.400,"pitch":33.047},{"time":11.408,"pitch":33.037},{"time":11.417,"pitch":33.030},{"time":11.425,"pitch":33.023},{"time":11.433,"pitch":33.019},{"time":11.442,"pitch":33.015},{"time":11.450,"pitch":33.012},{"time":11.458,"pitch":33.009},{"time":11.467,"pitch":33.007},{"time":11.475,"pitch":33.006},{"time":11.483,"pitch":33.005},{"time":11.492,"pitch":33.004},{"time":11.500,"pitch":33.003},{"time":11.508,"pitch":33.621},{"time":11.517,"pitch":34.112},{"time":11.525,"pitch":34.501},{"time":11.533,"pitch":34.811},{"time":11.542,"pitch":35.056},{"time":11.550,"pitch":35.251},{"time":11.558,"pitch":35.405},{"time":11.567,"pitch":35.528},{"time":11.575,"pitch":35.625},{"time":11.583,"pitch":35.703},{"time":11.592,"pitch":35.764},{"time":11.600,"pitch":35.813},{"time":11.608,"pitch":35.851},{"time":11.617,"pitch":35.882},{"time":11.625,"pitch":35.906},{"time":11.633,"pitch":35.926},{"time":11.642,"pitch":35.941},{"time":11.650,"pitch":35.953},{"time":11.658,"pitch":35.963},{"time":11.667,"pitch":35.970},{"time":11.675,"pitch":35.977},{"time":11.683,"pitch":35.981},{"time":11.692,"pitch":35.985},{"time":11.700,"pitch":35.988},{"time":11.708,"pitch":35.991},{"time":11.717,"pitch":35.993},{"time":11.725,"pitch":35.994},{"time":11.733,"pitch":35.995},{"time":11.742,"pitch":35.996},{"time":11.750,"pitch":35.997},{"time":11.758,"pitch":35.998},{"time":11.775,"pitch":35.999},{"time":11.817,"pitch":36.000},{"time":12.000,"pitch":36.413},{"time":12.008,"pitch":36.740},{"time":12.017,"pitch":37.000},{"time":12.025,"pitch":37.206},{"time":12.033,"pitch":37.370},{"time":12.042,"pitch":37.500},{"time":12.050,"pitch":37.603},{"time":12.058,"pitch":37.685},{"time":12.067,"pitch":37.750},{"time":12.075,"pitch":37.802},{"time":12.083,"pitch":37.843},{"time":12.092,"pitch":37.875},{"time":12.100,"pitch":37.901},{"time":12.108,"pitch":37.921},{"time":12.117,"pitch":37.937},{"time":12.125,"pitch":37.950},{"time":12.133,"pitch":37.961},{"time":12.142,"pitch":37.969},{"time":12.150,"pitch":37.975},{"time":12.158,"pitch":37.980},{"time":12.167,"pitch":37.984},{"time":12.175,"pitch":37.988},{"time":12.183,"pitch":37.990},{"time":12.192,"pitch":37.992},{"time":12.200,"pitch":37.994},{"time":12.208,"pitch":37.995},{"time":12.217,"pitch":37.996},{"time":12.225,"pitch":37.997},{"time":12.233,"pitch":37.998},{"time":12.258,"pitch":37.999},{"time":12.292,"pitch":38.000},{"time":12.733,"pitch":38.619},{"time":12.742,"pitch":39.110},{"time":12.750,"pitch":39.500},{"time":12.758,"pitch":39.809},{"time":12.767,"pitch":40.055},{"time":12.775,"pitch":40.250},{"time":12.783,"pitch":40.405},{"time":12.792,"pitch":40.528},{"time":12.800,"pitch":40.625},{"time":12.808,"pitch":40.702},{"time":12.817,"pitch":40.764},{"time":12.825,"pitch":40.812},{"time":12.833,"pitch":40.851},{"time":12.842,"pitch":40.882},{"time":12.850,"pitch":40.906},{"time":12.858,"pitch":40.926},{"time":12.867,"pitch":40.941},{"time":12.875,"pitch":40.953},{"time":12.883,"pitch":40.963},{"time":12.892,"pitch":40.970},{"time":12.900,"pitch":40.977},{"time":12.908,"pitch":40.981},{"time":12.917,"pitch":40.985},{"time":12.925,"pitch":40.988},{"time":12.933,"pitch":40.991},{"time":12.942,"pitch":40.993},{"time":12.950,"pitch":40.994},{"time":12.958,"pitch":40.995},{"time":12.967,"pitch":40.996},{"time":12.975,"pitch":40.997},{"time":12.983,"pitch":40.998},{"time":13.000,"pitch":40.999},{"time":13.042,"pitch":41.000},{"time":13.225,"pitch":41.619},{"time":13.233,"pitch":42.110},{"time":13.242,"pitch":42.500},{"time":13.250,"pitch":42.809},{"time":13.258,"pitch":43.055},{"time":13.267,"pitch":43.250},{"time":13.275,"pitch":43.405},{"time":13.283,"pitch":43.528},{"time":13.292,"pitch":43.625},{"time":13.300,"pitch":43.702},{"time":13.308,"pitch":43.764},{"time":13.317,"pitch":43.812},{"time":13.325,"pitch":43.851},{"time":13.333,"pitch":43.882},{"time":13.342,"pitch":43.906},{"time":13.350,"pitch":43.926},{"time":13.358,"pitch":43.941},{"time":13.367,"pitch":43.953},{"time":13.375,"pitch":43.963},{"time":13.383,"pitch":43.970},{"time":13.392,"pitch":43.977},{"time":13.400,"pitch":43.981},{"time":13.408,"pitch":43.985},{"time":13.417,"pitch":43.988},{"time":13.425,"pitch":43.991},{"time":13.433,"pitch":43.993},{"time":13.442,"pitch":43.994},{"time":13.450,"pitch":43.995},{"time":13.458,"pitch":43.996},{"time":13.467,"pitch":43.997},{"time":13.475,"pitch":43.998},{"time":13.492,"pitch":43.999},{"time":13.525,"pitch":43.793},{"time":13.533,"pitch":43.629},{"time":13.542,"pitch":43.500},{"time":13.550,"pitch":43.397},{"time":13.558,"pitch":43.315},{"time":13.567,"pitch":43.250},{"time":13.575,"pitch":43.198},{"time":13.583,"pitch":43.157},{"time":13.592,"pitch":43.125},{"time":13.600,"pitch":43.099},{"time":13.608,"pitch":43.079},{"time":13.617,"pitch":43.062},{"time":13.625,"pitch":43.050},{"time":13.633,"pitch":43.039},{"time":13.642,"pitch":43.031},{"time":13.650,"pitch":43.025},{"time":13.658,"pitch":43.020},{"time":13.667,"pitch":43.016},{"time":13.675,"pitch":43.012},{"time":13.683,"pitch":43.010},{"time":13.692,"pitch":43.008},{"time":13.700,"pitch":43.006},{"time":13.708,"pitch":43.005},{"time":13.717,"pitch":43.004},{"time":13.725,"pitch":43.003},{"time":13.733,"pitch":43.002},{"time":13.758,"pitch":43.001},{"time":13.792,"pitch":43.000},{"time":14.000,"pitch":42.587},{"time":14.008,"pitch":42.260},{"time":14.017,"pitch":42.000},{"time":14.025,"pitch":41.794},{"time":14.033,"pitch":41.630},{"time":14.042,"pitch":41.500},{"time":14.050,"pitch":41.397},{"time":14.058,"pitch":41.315},{"time":14.067,"pitch":41.250},{"time":14.075,"pitch":41.198},{"time":14.083,"pitch":41.157},{"time":14.092,"pitch":41.125},{"time":14.100,"pitch":41.099},{"time":14.108,"pitch":41.079},{"time":14.117,"pitch":41.063},{"time":14.125,"pitch":41.050},{"time":14.133,"pitch":41.039},{"time":14.142,"pitch":41.031},{"time":14.150,"pitch":41.025},{"time":14.158,"pitch":41.020},{"time":14.167,"pitch":41.016},{"time":14.175,"pitch":41.012},{"time":14.183,"pitch":41.010},{"time":14.192,"pitch":41.008},{"time":14.200,"pitch":41.006},{"time":14.208,"pitch":41.005},{"time":14.217,"pitch":41.004},{"time":14.225,"pitch":41.003},{"time":14.233,"pitch":41.002},{"time":14.258,"pitch":41.001},{"time":14.292,"pitch":41.000},{"time":14.758,"pitch":40.381},{"time":14.767,"pitch":39.890},{"time":14.775,"pitch":39.500},{"time":14.783,"pitch":39.191},{"time":14.792,"pitch":38.945},{"time":14.800,"pitch":38.750},{"time":14.808,"pitch":38.595},{"time":14.817,"pitch":38.472},{"time":14.825,"pitch":38.375},{"time":14.833,"pitch":38.298},{"time":14.842,"pitch":38.236},{"time":14.850,"pitch":38.188},{"time":14.858,"pitch":38.149},{"time":14.867,"pitch":38.118},{"time":14.875,"pitch":38.094},{"time":14.883,"pitch":38.074},{"time":14.892,"pitch":38.059},{"time":14.900,"pitch":38.047},{"time":14.908,"pitch":38.037},{"time":14.917,"pitch":38.030},{"time":14.925,"pitch":38.023},{"time":14.933,"pitch":38.019},{"time":14.942,"pitch":38.015},{"time":14.950,"pitch":38.012},{"time":14.958,"pitch":38.009},{"time":14.967,"pitch":38.007},{"time":14.975,"pitch":38.006},{"time":14.983,"pitch":38.005},{"time":14.992,"pitch":38.004},{"time":15.000,"pitch":38.003},{"time":15.008,"pitch":38.002},{"time":15.025,"pitch":38.001},{"time":15.067,"pitch":38.000},{"time":15.208,"pitch":36.969},{"time":15.217,"pitch":36.150},{"time":15.225,"pitch":35.500},{"time":15.233,"pitch":34.984},{"time":15.242,"pitch":34.575},{"time":15.250,"pitch":34.250},{"time":15.258,"pitch":33.992},{"time":15.267,"pitch":33.787},{"time":15.275,"pitch":33.625},{"time":15.283,"pitch":33.496},{"time":15.292,"pitch":33.394},{"time":15.300,"pitch":33.313},{"time":15.308,"pitch":33.248},{"time":15.317,"pitch":33.197},{"time":15.325,"pitch":33.156},{"time":15.333,"pitch":33.124},{"time":15.342,"pitch":33.098},{"time":15.350,"pitch":33.078},{"time":15.358,"pitch":33.062},{"time":15.367,"pitch":33.049},{"time":15.375,"pitch":33.039},{"time":15.383,"pitch":33.031},{"time":15.392,"pitch":33.025},{"time":15.400,"pitch":33.020},{"time":15.408,"pitch":33.016},{"time":15.417,"pitch":33.012},{"time":15.425,"pitch":33.010},{"time":15.433,"pitch":33.008},{"time":15.442,"pitch":33.006},{"time":15.450,"pitch":33.005},{"time":15.458,"pitch":33.004},{"time":15.467,"pitch":33.003},{"time":15.475,"pitch":33.002},{"time":15.500,"pitch":33.001},{"time":15.508,"pitch":33.620},{"time":15.517,"pitch":34.111},{"time":15.525,"pitch":34.501},{"time":15.533,"pitch":34.810},{"time":15.542,"pitch":35.055},{"time":15.550,"pitch":35.250},{"time":15.558,"pitch":35.405},{"time":15.567,"pitch":35.528},{"time":15.575,"pitch":35.625},{"time":15.583,"pitch":35.702},{"time":15.592,"pitch":35.764},{"time":15.600,"pitch":35.813},{"time":15.608,"pitch":35.851},{"time":15.617,"pitch":35.882},{"time":15.625,"pitch":35.906},{"time":15.633,"pitch":35.926},{"time":15.642,"pitch":35.941},{"time":15.650,"pitch":35.953},{"time":15.658,"pitch":35.963},{"time":15.667,"pitch":35.970},{"time":15.675,"pitch":35.977},{"time":15.683,"pitch":35.981},{"time":15.692,"pitch":35.985},{"time":15.700,"pitch":35.988},{"time":15.708,"pitch":35.991},{"time":15.717,"pitch":35.993},{"time":15.725,"pitch":35.994},{"time":15.733,"pitch":35.995},{"time":15.742,"pitch":35.996},{"time":15.750,"pitch":35.997},{"time":15.758,"pitch":35.998},{"time":15.775,"pitch":35.999},{"time":15.817,"pitch":36.000},{"time":16.000,"pitch":36.413},{"time":16.008,"pitch":36.740},{"time":16.017,"pitch":37.000},{"time":16.025,"pitch":37.206},{"time":16.033,"pitch":37.370},{"time":16.042,"pitch":37.500},{"time":16.050,"pitch":37.603},{"time":16.058,"pitch":37.685},{"time":16.067,"pitch":37.750},{"time":16.075,"pitch":37.802},{"time":16.083,"pitch":37.843},{"time":16.092,"pitch":37.875},{"time":16.100,"pitch":37.901},{"time":16.108,"pitch":37.921},{"time":16.117,"pitch":37.937},{"time":16.125,"pitch":37.950},{"time":16.133,"pitch":37.961},{"time":16.142,"pitch":37.969},{"time":16.150,"pitch":37.975},{"time":16.158,"pitch":37.980},{"time":16.167,"pitch":37.984},{"time":16.175,"pitch":37.988},{"time":16.183,"pitch":37.990},{"time":16.192,"pitch":37.992},{"time":16.200,"pitch":37.994},{"time":16.208,"pitch":37.995},{"time":16.217,"pitch":37.996},{"time":16.225,"pitch":37.997},{"time":16.233,"pitch":37.998},{"time":16.258,"pitch":37.999},{"time":16.292,"pitch":38.000},{"time":16.733,"pitch":38.619},{"time":16.742,"pitch":39.110},{"time":16.750,"pitch":39.500},{"time":16.758,"pitch":39.809},{"time":16.767,"pitch":40.055},{"time":16.775,"pitch":40.250},{"time":16.783,"pitch":40.405},{"time":16.792,"pitch":40.528},{"time":16.800,"pitch":40.625},{"time":16.808,"pitch":40.702},{"time":16.817,"pitch":40.764},{"time":16.825,"pitch":40.812},{"time":16.833,"pitch":40.851},{"time":16.842,"pitch":40.882},{"time":16.850,"pitch":40.906},{"time":16.858,"pitch":40.926},{"time":16.867,"pitch":40.941},{"time":16.875,"pitch":40.953},{"time":16.883,"pitch":40.963},{"time":16.892,"pitch":40.970},{"time":16.900,"pitch":40.977},{"time":16.908,"pitch":40.981},{"time":16.917,"pitch":40.985},{"time":16.925,"pitch":40.988},{"time":16.933,"pitch":40.991},{"time":16.942,"pitch":40.993},{"time":16.950,"pitch":40.994},{"time":16.958,"pitch":40.995},{"time":16.967,"pitch":40.996},{"time":16.975,"pitch":40.997},{"time":16.983,"pitch":40.998},{"time":17.000,"pitch":40.999},{"time":17.042,"pitch":41.000},{"time":17.258,"pitch":40.381},{"time":17.267,"pitch":39.890},{"time":17.275,"pitch":39.500},{"time":17.283,"pitch":39.191},{"time":17.292,"pitch":38.945},{"time":17.300,"pitch":38.750},{"time":17.308,"pitch":38.595},{"time":17.317,"pitch":38.472},{"time":17.325,"pitch":38.375},{"time":17.333,"pitch":38.298},{"time":17.342,"pitch":38.236},{"time":17.350,"pitch":38.187},{"time":17.358,"pitch":38.149},{"time":17.367,"pitch":38.118},{"time":17.375,"pitch":38.094},{"time":17.383,"pitch":38.074},{"time":17.392,"pitch":38.059},{"time":17.400,"pitch":38.047},{"time":17.408,"pitch":38.037},{"time":17.417,"pitch":38.030},{"time":17.425,"pitch":38.023},{"time":17.433,"pitch":38.019},{"time":17.442,"pitch":38.015},{"time":17.450,"pitch":38.012},{"time":17.458,"pitch":38.009},{"time":17.467,"pitch":38.007},{"time":17.475,"pitch":38.006},{"time":17.483,"pitch":38.005},{"time":17.492,"pitch":38.004},{"time":17.500,"pitch":38.622},{"time":17.508,"pitch":39.112},{"time":17.517,"pitch":39.502},{"time":17.525,"pitch":39.811},{"time":17.533,"pitch":40.056},{"time":17.542,"pitch":40.251},{"time":17.550,"pitch":40.405},{"time":17.558,"pitch":40.528},{"time":17.567,"pitch":40.625},{"time":17.575,"pitch":40.703},{"time":17.583,"pitch":40.764},{"time":17.592,"pitch":40.813},{"time":17.600,"pitch":40.851},{"time":17.608,"pitch":40.882},{"time":17.617,"pitch":40.906},{"time":17.625,"pitch":40.926},{"time":17.633,"pitch":40.941},{"time":17.642,"pitch":40.953},{"time":17.650,"pitch":40.963},{"time":17.658,"pitch":40.971},{"time":17.667,"pitch":40.977},{"time":17.675,"pitch":40.981},{"time":17.683,"pitch":40.985},{"time":17.692,"pitch":40.988},{"time":17.700,"pitch":40.991},{"time":17.708,"pitch":40.993},{"time":17.717,"pitch":40.994},{"time":17.725,"pitch":40.995},{"time":17.733,"pitch":40.996},{"time":17.742,"pitch":40.997},{"time":17.750,"pitch":40.998},{"time":17.767,"pitch":40.999},{"time":17.808,"pitch":41.000},{"time":18.008,"pitch":40.381},{"time":18.017,"pitch":39.890},{"time":18.025,"pitch":39.500},{"time":18.033,"pitch":39.191},{"time":18.042,"pitch":38.945},{"time":18.050,"pitch":38.750},{"time":18.058,"pitch":38.595},{"time":18.067,"pitch":38.472},{"time":18.075,"pitch":38.375},{"time":18.083,"pitch":38.298},{"time":18.092,"pitch":38.236},{"time":18.100,"pitch":38.187},{"time":18.108,"pitch":38.149},{"time":18.117,"pitch":38.118},{"time":18.125,"pitch":38.094},{"time":18.133,"pitch":38.074},{"time":18.142,"pitch":38.059},{"time":18.150,"pitch":38.047},{"time":18.158,"pitch":38.037},{"time":18.167,"pitch":38.030},{"time":18.175,"pitch":38.023},{"time":18.183,"pitch":38.019},{"time":18.192,"pitch":38.015},{"time":18.200,"pitch":38.012},{"time":18.208,"pitch":38.009},{"time":18.217,"pitch":38.007},{"time":18.225,"pitch":38.006},{"time":18.233,"pitch":38.005},{"time":18.242,"pitch":38.004},{"time":18.250,"pitch":38.003},{"time":18.258,"pitch":38.002},{"time":18.275,"pitch":38.001},{"time":18.317,"pitch":38.000},{"time":18.758,"pitch":37.587},{"time":18.767,"pitch":37.260},{"time":18.775,"pitch":37.000},{"time":18.783,"pitch":36.794},{"time":18.792,"pitch":36.630},{"time":18.800,"pitch":36.500},{"time":18.808,"pitch":36.397},{"time":18.817,"pitch":36.315},{"time":18.825,"pitch":36.250},{"time":18.833,"pitch":36.198},{"time":18.842,"pitch":36.157},{"time":18.850,"pitch":36.125},{"time":18.858,"pitch":36.099},{"time":18.867,"pitch":36.079},{"time":18.875,"pitch":36.063},{"time":18.883,"pitch":36.050},{"time":18.892,"pitch":36.039},{"time":18.900,"pitch":36.031},{"time":18.908,"pitch":36.025},{"time":18.917,"pitch":36.020},{"time":18.925,"pitch":36.016},{"time":18.933,"pitch":36.012},{"time":18.942,"pitch":36.010},{"time":18.950,"pitch":36.008},{"time":18.958,"pitch":36.006},{"time":18.967,"pitch":36.005},{"time":18.975,"pitch":36.004},{"time":18.983,"pitch":36.003},{"time":18.992,"pitch":36.002},{"time":19.017,"pitch":36.001},{"time":19.050,"pitch":36.000},{"time":19.258,"pitch":35.381},{"time":19.267,"pitch":34.890},{"time":19.275,"pitch":34.500},{"time":19.283,"pitch":34.191},{"time":19.292,"pitch":33.945},{"time":19.300,"pitch":33.750},{"time":19.308,"pitch":33.595},{"time":19.317,"pitch":33.472},{"time":19.325,"pitch":33.375},{"time":19.333,"pitch":33.298},{"time":19.342,"pitch":33.236},{"time":19.350,"pitch":33.188},{"time":19.358,"pitch":33.149},{"time":19.367,"pitch":33.118},{"time":19.375,"pitch":33.094},{"time":19.383,"pitch":33.074},{"time":19.392,"pitch":33.059},{"time":19.400,"pitch":33.047},{"time":19.408,"pitch":33.037},{"time":19.417,"pitch":33.030},{"time":19.425,"pitch":33.023},{"time":19.433,"pitch":33.019},{"time":19.442,"pitch":33.015},{"time":19.450,"pitch":33.012},{"time":19.458,"pitch":33.009},{"time":19.467,"pitch":33.007},{"time":19.475,"pitch":33.006},{"time":19.483,"pitch":33.005},{"time":19.492,"pitch":33.004},{"time":19.500,"pitch":33.003},{"time":19.508,"pitch":33.621},{"time":19.517,"pitch":34.112},{"time":19.525,"pitch":34.501},{"time":19.533,"pitch":34.811},{"time":19.542,"pitch":35.056},{"time":19.550,"pitch":35.251},{"time":19.558,"pitch":35.405},{"time":19.567,"pitch":35.528},{"time":19.575,"pitch":35.625},{"time":19.583,"pitch":35.703},{"time":19.592,"pitch":35.764},{"time":19.600,"pitch":35.813},{"time":19.608,"pitch":35.851},{"time":19.617,"pitch":35.882},{"time":19.625,"pitch":35.906},{"time":19.633,"pitch":35.926},{"time":19.642,"pitch":35.941},{"time":19.650,"pitch":35.953},{"time":19.658,"pitch":35.963},{"time":19.667,"pitch":35.970},{"time":19.675,"pitch":35.977},{"time":19.683,"pitch":35.981},{"time":19.692,"pitch":35.985},{"time":19.700,"pitch":35.988},{"time":19.708,"pitch":35.991},{"time":19.717,"pitch":35.993},{"time":19.725,"pitch":35.994},{"time":19.733,"pitch":35.995},{"time":19.742,"pitch":35.996},{"time":19.750,"pitch":35.997},{"time":19.758,"pitch":35.998},{"time":19.775,"pitch":35.999},{"time":19.817,"pitch":36.000},{"time":20.000,"pitch":36.413},{"time":20.008,"pitch":36.740},{"time":20.017,"pitch":37.000},{"time":20.025,"pitch":37.206},{"time":20.033,"pitch":37.370},{"time":20.042,"pitch":37.500},{"time":20.050,"pitch":37.603},{"time":20.058,"pitch":37.685},{"time":20.067,"pitch":37.750},{"time":20.075,"pitch":37.802},{"time":20.083,"pitch":37.843},{"time":20.092,"pitch":37.875},{"time":20.100,"pitch":37.901},{"time":20.108,"pitch":37.921},{"time":20.117,"pitch":37.937},{"time":20.125,"pitch":37.950},{"time":20.133,"pitch":37.961},{"time":20.142,"pitch":37.969},{"time":20.150,"pitch":37.975},{"time":20.158,"pitch":37.980},{"time":20.167,"pitch":37.984},{"time":20.175,"pitch":37.988},{"time":20.183,"pitch":37.990},{"time":20.192,"pitch":37.992},{"time":20.200,"pitch":37.994},{"time":20.208,"pitch":37.995},{"time":20.217,"pitch":37.996},{"time":20.225,"pitch":37.997},{"time":20.233,"pitch":37.998},{"time":20.258,"pitch":37.999},{"time":20.292,"pitch":38.000},{"time":20.733,"pitch":38.619},{"time":20.742,"pitch":39.110},{"time":20.750,"pitch":39.500},{"time":20.758,"pitch":39.809},{"time":20.767,"pitch":40.055},{"time":20.775,"pitch":40.250},{"time":20.783,"pitch":40.405},{"time":20.792,"pitch":40.528},{"time":20.800,"pitch":40.625},{"time":20.808,"pitch":40.702},{"time":20.817,"pitch":40.764},{"time":20.825,"pitch":40.812},{"time":20.833,"pitch":40.851},{"time":20.842,"pitch":40.882},{"time":20.850,"pitch":40.906},{"time":20.858,"pitch":40.926},{"time":20.867,"pitch":40.941},{"time":20.875,"pitch":40.953},{"time":20.883,"pitch":40.963},{"time":20.892,"pitch":40.970},{"time":20.900,"pitch":40.977},{"time":20.908,"pitch":40.981},{"time":20.917,"pitch":40.985},{"time":20.925,"pitch":40.988},{"time":20.933,"pitch":40.991},{"time":20.942,"pitch":40.993},{"time":20.950,"pitch":40.994},{"time":20.958,"pitch":40.995},{"time":20.967,"pitch":40.996},{"time":20.975,"pitch":40.997},{"time":20.983,"pitch":40.998},{"time":21.000,"pitch":40.999},{"time":21.042,"pitch":41.000},{"time":21.258,"pitch":40.381},{"time":21.267,"pitch":39.890},{"time":21.275,"pitch":39.500},{"time":21.283,"pitch":39.191},{"time":21.292,"pitch":38.945},{"time":21.300,"pitch":38.750},{"time":21.308,"pitch":38.595},{"time":21.317,"pitch":38.472},{"time":21.325,"pitch":38.375},{"time":21.333,"pitch":38.298},{"time":21.342,"pitch":38.236},{"time":21.350,"pitch":38.187},{"time":21.358,"pitch":38.149},{"time":21.367,"pitch":38.118},{"time":21.375,"pitch":38.094},{"time":21.383,"pitch":38.074},{"time":21.392,"pitch":38.059},{"time":21.400,"pitch":38.047},{"time":21.408,"pitch":38.037},{"time":21.417,"pitch":38.030},{"time":21.425,"pitch":38.023},{"time":21.433,"pitch":38.019},{"time":21.442,"pitch":38.015},{"time":21.450,"pitch":38.012},{"time":21.458,"pitch":38.009},{"time":21.467,"pitch":38.007},{"time":21.475,"pitch":38.006},{"time":21.483,"pitch":38.005},{"time":21.492,"pitch":38.004},{"time":21.500,"pitch":38.622},{"time":21.508,"pitch":39.112},{"time":21.517,"pitch":39.502},{"time":21.525,"pitch":39.811},{"time":21.533,"pitch":40.056},{"time":21.542,"pitch":40.251},{"time":21.550,"pitch":40.405},{"time":21.558,"pitch":40.528},{"time":21.567,"pitch":40.625},{"time":21.575,"pitch":40.703},{"time":21.583,"pitch":40.764},{"time":21.592,"pitch":40.813},{"time":21.600,"pitch":40.851},{"time":21.608,"pitch":40.882},{"time":21.617,"pitch":40.906},{"time":21.625,"pitch":40.926},{"time":21.633,"pitch":40.941},{"time":21.642,"pitch":40.953},{"time":21.650,"pitch":40.963},{"time":21.658,"pitch":40.971},{"time":21.667,"pitch":40.977},{"time":21.675,"pitch":40.981},{"time":21.683,"pitch":40.985},{"time":21.692,"pitch":40.988},{"time":21.700,"pitch":40.991},{"time":21.708,"pitch":40.993},{"time":21.717,"pitch":40.994},{"time":21.725,"pitch":40.995},{"time":21.733,"pitch":40.996},{"time":21.742,"pitch":40.997},{"time":21.750,"pitch":40.998},{"time":21.767,"pitch":40.999},{"time":21.808,"pitch":41.000},{"time":22.008,"pitch":40.381},{"time":22.017,"pitch":39.890},{"time":22.025,"pitch":39.500},{"time":22.033,"pitch":39.191},{"time":22.042,"pitch":38.945},{"time":22.050,"pitch":38.750},{"time":22.058,"pitch":38.595},{"time":22.067,"pitch":38.472},{"time":22.075,"pitch":38.375},{"time":22.083,"pitch":38.298},{"time":22.092,"pitch":38.236},{"time":22.100,"pitch":38.187},{"time":22.108,"pitch":38.149},{"time":22.117,"pitch":38.118},{"time":22.125,"pitch":38.094},{"time":22.133,"pitch":38.074},{"time":22.142,"pitch":38.059},{"time":22.150,"pitch":38.047},{"time":22.158,"pitch":38.037},{"time":22.167,"pitch":38.030},{"time":22.175,"pitch":38.023},{"time":22.183,"pitch":38.019},{"time":22.192,"pitch":38.015},{"time":22.200,"pitch":38.012},{"time":22.208,"pitch":38.009},{"time":22.217,"pitch":38.007},{"time":22.225,"pitch":38.006},{"time":22.233,"pitch":38.005},{"time":22.242,"pitch":38.004},{"time":22.250,"pitch":38.003},{"time":22.258,"pitch":38.002},{"time":22.275,"pitch":38.001},{"time":22.317,"pitch":38.000},{"time":22.758,"pitch":37.587},{"time":22.767,"pitch":37.260},{"time":22.775,"pitch":37.000},{"time":22.783,"pitch":36.794},{"time":22.792,"pitch":36.630},{"time":22.800,"pitch":36.500},{"time":22.808,"pitch":36.397},{"time":22.817,"pitch":36.315},{"time":22.825,"pitch":36.250},{"time":22.833,"pitch":36.198},{"time":22.842,"pitch":36.157},{"time":22.850,"pitch":36.125},{"time":22.858,"pitch":36.099},{"time":22.867,"pitch":36.079},{"time":22.875,"pitch":36.063},{"time":22.883,"pitch":36.050},{"time":22.892,"pitch":36.039},{"time":22.900,"pitch":36.031},{"time":22.908,"pitch":36.025},{"time":22.917,"pitch":36.020},{"time":22.925,"pitch":36.016},{"time":22.933,"pitch":36.012},{"time":22.942,"pitch":36.010},{"time":22.950,"pitch":36.008},{"time":22.958,"pitch":36.006},{"time":22.967,"pitch":36.005},{"time":22.975,"pitch":36.004},{"time":22.983,"pitch":36.003},{"time":22.992,"pitch":36.002},{"time":23.017,"pitch":36.001},{"time":23.050,"pitch":36.000},{"time":23.258,"pitch":35.381},{"time":23.267,"pitch":34.890},{"time":23.275,"pitch":34.500},{"time":23.283,"pitch":34.191},{"time":23.292,"pitch":33.945},{"time":23.300,"pitch":33.750},{"time":23.308,"pitch":33.595},{"time":23.317,"pitch":33.472},{"time":23.325,"pitch":33.375},{"time":23.333,"pitch":33.298},{"time":23.342,"pitch":33.236},{"time":23.350,"pitch":33.188},{"time":23.358,"pitch":33.149},{"time":23.367,"pitch":33.118},{"time":23.375,"pitch":33.094},{"time":23.383,"pitch":33.074},{"time":23.392,"pitch":33.059},{"time":23.400,"pitch":33.047},{"time":23.408,"pitch":33.037},{"time":23.417,"pitch":33.030},{"time":23.425,"pitch":33.023},{"time":23.433,"pitch":33.019},{"time":23.442,"pitch":33.015},{"time":23.450,"pitch":33.012},{"time":23.458,"pitch":33.009},{"time":23.467,"pitch":33.007},{"time":23.475,"pitch":33.006},{"time":23.483,"pitch":33.005},{"time":23.492,"pitch":33.004},{"time":23.500,"pitch":33.003},{"time":23.508,"pitch":33.621},{"time":23.517,"pitch":34.112},{"time":23.525,"pitch":34.501},{"time":23.533,"pitch":34.811},{"time":23.542,"pitch":35.056},{"time":23.550,"pitch":35.251},{"time":23.558,"pitch":35.405},{"time":23.567,"pitch":35.528},{"time":23.575,"pitch":35.625},{"time":23.583,"pitch":35.703},{"time":23.592,"pitch":35.764},{"time":23.600,"pitch":35.813},{"time":23.608,"pitch":35.851},{"time":23.617,"pitch":35.882},{"time":23.625,"pitch":35.906},{"time":23.633,"pitch":35.926},{"time":23.642,"pitch":35.941},{"time":23.650,"pitch":35.953},{"time":23.658,"pitch":35.963},{"time":23.667,"pitch":35.970},{"time":23.675,"pitch":35.977},{"time":23.683,"pitch":35.981},{"time":23.692,"pitch":35.985},{"time":23.700,"pitch":35.988},{"time":23.708,"pitch":35.991},{"time":23.717,"pitch":35.993},{"time":23.725,"pitch":35.994},{"time":23.733,"pitch":35.995},{"time":23.742,"pitch":35.996},{"time":23.750,"pitch":35.997},{"time":23.758,"pitch":35.998},{"time":23.775,"pitch":35.999},{"time":23.817,"pitch":36.000},{"time":24.000,"pitch":36.413},{"time":24.008,"pitch":36.740},{"time":24.017,"pitch":37.000},{"time":24.025,"pitch":37.206},{"time":24.033,"pitch":37.370},{"time":24.042,"pitch":37.500},{"time":24.050,"pitch":37.603},{"time":24.058,"pitch":37.685},{"time":24.067,"pitch":37.750},{"time":24.075,"pitch":37.802},{"time":24.083,"pitch":37.843},{"time":24.092,"pitch":37.875},{"time":24.100,"pitch":37.901},{"time":24.108,"pitch":37.921},{"time":24.117,"pitch":37.937},{"time":24.125,"pitch":37.950},{"time":24.133,"pitch":37.961},{"time":24.142,"pitch":37.969},{"time":24.150,"pitch":37.975},{"time":24.158,"pitch":37.980},{"time":24.167,"pitch":37.984},{"time":24.175,"pitch":37.988},{"time":24.183,"pitch":37.990},{"time":24.192,"pitch":37.992},{"time":24.200,"pitch":37.994},{"time":24.208,"pitch":37.995},{"time":24.217,"pitch":37.996},{"time":24.225,"pitch":37.997},{"time":24.233,"pitch":37.998},{"time":24.258,"pitch":37.999},{"time":24.292,"pitch":38.000},{"time":24.733,"pitch":38.619},{"time":24.742,"pitch":39.110},{"time":24.750,"pitch":39.500},{"time":24.758,"pitch":39.809},{"time":24.767,"pitch":40.055},{"time":24.775,"pitch":40.250},{"time":24.783,"pitch":40.405},{"time":24.792,"pitch":40.528},{"time":24.800,"pitch":40.625},{"time":24.808,"pitch":40.702},{"time":24.817,"pitch":40.764},{"time":24.825,"pitch":40.812},{"time":24.833,"pitch":40.851},{"time":24.842,"pitch":40.882},{"time":24.850,"pitch":40.906},{"time":24.858,"pitch":40.926},{"time":24.867,"pitch":40.941},{"time":24.875,"pitch":40.953},{"time":24.883,"pitch":40.963},{"time":24.892,"pitch":40.970},{"time":24.900,"pitch":40.977},{"time":24.908,"pitch":40.981},{"time":24.917,"pitch":40.985},{"time":24.925,"pitch":40.988},{"time":24.933,"pitch":40.991},{"time":24.942,"pitch":40.993},{"time":24.950,"pitch":40.994},{"time":24.958,"pitch":40.995},{"time":24.967,"pitch":40.996},{"time":24.975,"pitch":40.997},{"time":24.983,"pitch":40.998},{"time":25.000,"pitch":40.999},{"time":25.042,"pitch":41.000},{"time":25.258,"pitch":40.381},{"time":25.267,"pitch":39.890},{"time":25.275,"pitch":39.500},{"time":25.283,"pitch":39.191},{"time":25.292,"pitch":38.945},{"time":25.300,"pitch":38.750},{"time":25.308,"pitch":38.595},{"time":25.317,"pitch":38.472},{"time":25.325,"pitch":38.375},{"time":25.333,"pitch":38.298},{"time":25.342,"pitch":38.236},{"time":25.350,"pitch":38.187},{"time":25.358,"pitch":38.149},{"time":25.367,"pitch":38.118},{"time":25.375,"pitch":38.094},{"time":25.383,"pitch":38.074},{"time":25.392,"pitch":38.059},{"time":25.400,"pitch":38.047},{"time":25.408,"pitch":38.037},{"time":25.417,"pitch":38.030},{"time":25.425,"pitch":38.023},{"time":25.433,"pitch":38.019},{"time":25.442,"pitch":38.015},{"time":25.450,"pitch":38.012},{"time":25.458,"pitch":38.009},{"time":25.467,"pitch":38.007},{"time":25.475,"pitch":38.006},{"time":25.483,"pitch":38.005},{"time":25.492,"pitch":38.004},{"time":25.500,"pitch":38.622},{"time":25.508,"pitch":39.112},{"time":25.517,"pitch":39.502},{"time":25.525,"pitch":39.811},{"time":25.533,"pitch":40.056},{"time":25.542,"pitch":40.251},{"time":25.550,"pitch":40.405},{"time":25.558,"pitch":40.528},{"time":25.567,"pitch":40.625},{"time":25.575,"pitch":40.703},{"time":25.583,"pitch":40.764},{"time":25.592,"pitch":40.813},{"time":25.600,"pitch":40.851},{"time":25.608,"pitch":40.882},{"time":25.617,"pitch":40.906},{"time":25.625,"pitch":40.926},{"time":25.633,"pitch":40.941},{"time":25.642,"pitch":40.953},{"time":25.650,"pitch":40.963},{"time":25.658,"pitch":40.971},{"time":25.667,"pitch":40.977},{"time":25.675,"pitch":40.981},{"time":25.683,"pitch":40.985},{"time":25.692,"pitch":40.988},{"time":25.700,"pitch":40.991},{"time":25.708,"pitch":40.993},{"time":25.717,"pitch":40.994},{"time":25.725,"pitch":40.995},{"time":25.733,"pitch":40.996},{"time":25.742,"pitch":40.997},{"time":25.750,"pitch":40.998},{"time":25.767,"pitch":40.999},{"time":25.808,"pitch":41.000},{"time":26.008,"pitch":40.381},{"time":26.017,"pitch":39.890},{"time":26.025,"pitch":39.500},{"time":26.033,"pitch":39.191},{"time":26.042,"pitch":38.945},{"time":26.050,"pitch":38.750},{"time":26.058,"pitch":38.595},{"time":26.067,"pitch":38.472},{"time":26.075,"pitch":38.375},{"time":26.083,"pitch":38.298},{"time":26.092,"pitch":38.236},{"time":26.100,"pitch":38.187},{"time":26.108,"pitch":38.149},{"time":26.117,"pitch":38.118},{"time":26.125,"pitch":38.094},{"time":26.133,"pitch":38.074},{"time":26.142,"pitch":38.059},{"time":26.150,"pitch":38.047},{"time":26.158,"pitch":38.037},{"time":26.167,"pitch":38.030},{"time":26.175,"pitch":38.023},{"time":26.183,"pitch":38.019},{"time":26.192,"pitch":38.015},{"time":26.200,"pitch":38.012},{"time":26.208,"pitch":38.009},{"time":26.217,"pitch":38.007},{"time":26.225,"pitch":38.006},{"time":26.233,"pitch":38.005},{"time":26.242,"pitch":38.004},{"time":26.250,"pitch":38.003},{"time":26.258,"pitch":38.002},{"time":26.275,"pitch":38.001},{"time":26.317,"pitch":38.000},{"time":26.758,"pitch":37.587},{"time":26.767,"pitch":37.260},{"time":26.775,"pitch":37.000},{"time":26.783,"pitch":36.794},{"time":26.792,"pitch":36.630},{"time":26.800,"pitch":36.500},{"time":26.808,"pitch":36.397},{"time":26.817,"pitch":36.315},{"time":26.825,"pitch":36.250},{"time":26.833,"pitch":36.198},{"time":26.842,"pitch":36.157},{"time":26.850,"pitch":36.125},{"time":26.858,"pitch":36.099},{"time":26.867,"pitch":36.079},{"time":26.875,"pitch":36.063},{"time":26.883,"pitch":36.050},{"time":26.892,"pitch":36.039},{"time":26.900,"pitch":36.031},{"time":26.908,"pitch":36.025},{"time":26.917,"pitch":36.020},{"time":26.925,"pitch":36.016},{"time":26.933,"pitch":36.012},{"time":26.942,"pitch":36.010},{"time":26.950,"pitch":36.008},{"time":26.958,"pitch":36.006},{"time":26.967,"pitch":36.005},{"time":26.975,"pitch":36.004},{"time":26.983,"pitch":36.003},{"time":26.992,"pitch":36.002},{"time":27.017,"pitch":36.001},{"time":27.050,"pitch":36.000},{"time":27.258,"pitch":35.381},{"time":27.267,"pitch":34.890},{"time":27.275,"pitch":34.500},{"time":27.283,"pitch":34.191},{"time":27.292,"pitch":33.945},{"time":27.300,"pitch":33.750},{"time":27.308,"pitch":33.595},{"time":27.317,"pitch":33.472},{"time":27.325,"pitch":33.375},{"time":27.333,"pitch":33.298},{"time":27.342,"pitch":33.236},{"time":27.350,"pitch":33.188},{"time":27.358,"pitch":33.149},{"time":27.367,"pitch":33.118},{"time":27.375,"pitch":33.094},{"time":27.383,"pitch":33.074},{"time":27.392,"pitch":33.059},{"time":27.400,"pitch":33.047},{"time":27.408,"pitch":33.037},{"time":27.417,"pitch":33.030},{"time":27.425,"pitch":33.023},{"time":27.433,"pitch":33.019},{"time":27.442,"pitch":33.015},{"time":27.450,"pitch":33.012},{"time":27.458,"pitch":33.009},{"time":27.467,"pitch":33.007},{"time":27.475,"pitch":33.006},{"time":27.483,"pitch":33.005},{"time":27.492,"pitch":33.004},{"time":27.500,"pitch":33.003},{"time":27.508,"pitch":33.621},{"time":27.517,"pitch":34.112},{"time":27.525,"pitch":34.501},{"time":27.533,"pitch":34.811},{"time":27.542,"pitch":35.056},{"time":27.550,"pitch":35.251},{"time":27.558,"pitch":35.405},{"time":27.567,"pitch":35.528},{"time":27.575,"pitch":35.625},{"time":27.583,"pitch":35.703},{"time":27.592,"pitch":35.764},{"time":27.600,"pitch":35.813},{"time":27.608,"pitch":35.851},{"time":27.617,"pitch":35.882},{"time":27.625,"pitch":35.906},{"time":27.633,"pitch":35.926},{"time":27.642,"pitch":35.941},{"time":27.650,"pitch":35.953},{"time":27.658,"pitch":35.963},{"time":27.667,"pitch":35.970},{"time":27.675,"pitch":35.977},{"time":27.683,"pitch":35.981},{"time":27.692,"pitch":35.985},{"time":27.700,"pitch":35.988},{"time":27.708,"pitch":35.991},{"time":27.717,"pitch":35.993},{"time":27.725,"pitch":35.994},{"time":27.733,"pitch":35.995},{"time":27.742,"pitch":35.996},{"time":27.750,"pitch":35.997},{"time":27.758,"pitch":35.998},{"time":27.775,"pitch":35.999},{"time":27.817,"pitch":36.000},{"time":28.000,"pitch":36.413},{"time":28.008,"pitch":36.740},{"time":28.017,"pitch":37.000},{"time":28.025,"pitch":37.206},{"time":28.033,"pitch":37.370},{"time":28.042,"pitch":37.500},{"time":28.050,"pitch":37.603},{"time":28.058,"pitch":37.685},{"time":28.067,"pitch":37.750},{"time":28.075,"pitch":37.802},{"time":28.083,"pitch":37.843},{"time":28.092,"pitch":37.875},{"time":28.100,"pitch":37.901},{"time":28.108,"pitch":37.921},{"time":28.117,"pitch":37.937},{"time":28.125,"pitch":37.950},{"time":28.133,"pitch":37.961},{"time":28.142,"pitch":37.969},{"time":28.150,"pitch":37.975},{"time":28.158,"pitch":37.980},{"time":28.167,"pitch":37.984},{"time":28.175,"pitch":37.988},{"time":28.183,"pitch":37.990},{"time":28.192,"pitch":37.992},{"time":28.200,"pitch":37.994},{"time":28.208,"pitch":37.995},{"time":28.217,"pitch":37.996},{"time":28.225,"pitch":37.997},{"time":28.233,"pitch":37.998},{"time":28.258,"pitch":37.999},{"time":28.292,"pitch":38.000},{"time":28.733,"pitch":38.619},{"time":28.742,"pitch":39.110},{"time":28.750,"pitch":39.500},{"time":28.758,"pitch":39.809},{"time":28.767,"pitch":40.055},{"time":28.775,"pitch":40.250},{"time":28.783,"pitch":40.405},{"time":28.792,"pitch":40.528},{"time":28.800,"pitch":40.625},{"time":28.808,"pitch":40.702},{"time":28.817,"pitch":40.764},{"time":28.825,"pitch":40.812},{"time":28.833,"pitch":40.851},{"time":28.842,"pitch":40.882},{"time":28.850,"pitch":40.906},{"time":28.858,"pitch":40.926},{"time":28.867,"pitch":40.941},{"time":28.875,"pitch":40.953},{"time":28.883,"pitch":40.963},{"time":28.892,"pitch":40.970},{"time":28.900,"pitch":40.977},{"time":28.908,"pitch":40.981},{"time":28.917,"pitch":40.985},{"time":28.925,"pitch":40.988},{"time":28.933,"pitch":40.991},{"time":28.942,"pitch":40.993},{"time":28.950,"pitch":40.994},{"time":28.958,"pitch":40.995},{"time":28.967,"pitch":40.996},{"time":28.975,"pitch":40.997},{"time":28.983,"pitch":40.998},{"time":29.000,"pitch":40.999},{"time":29.042,"pitch":41.000},{"time":29.225,"pitch":41.619},{"time":29.233,"pitch":42.110},{"time":29.242,"pitch":42.500},{"time":29.250,"pitch":42.809},{"time":29.258,"pitch":43.055},{"time":29.267,"pitch":43.250},{"time":29.275,"pitch":43.405},{"time":29.283,"pitch":43.528},{"time":29.292,"pitch":43.625},{"time":29.300,"pitch":43.702},{"time":29.308,"pitch":43.764},{"time":29.317,"pitch":43.812},{"time":29.325,"pitch":43.851},{"time":29.333,"pitch":43.882},{"time":29.342,"pitch":43.906},{"time":29.350,"pitch":43.926},{"time":29.358,"pitch":43.941},{"time":29.367,"pitch":43.953},{"time":29.375,"pitch":43.963},{"time":29.383,"pitch":43.970},{"time":29.392,"pitch":43.977},{"time":29.400,"pitch":43.981},{"time":29.408,"pitch":43.985},{"time":29.417,"pitch":43.988},{"time":29.425,"pitch":43.991},{"time":29.433,"pitch":43.993},{"time":29.442,"pitch":43.994},{"time":29.450,"pitch":43.995},{"time":29.458,"pitch":43.996},{"time":29.467,"pitch":43.997},{"time":29.475,"pitch":43.998},{"time":29.492,"pitch":43.999},{"time":29.525,"pitch":43.793},{"time":29.533,"pitch":43.629},{"time":29.542,"pitch":43.500},{"time":29.550,"pitch":43.397},{"time":29.558,"pitch":43.315},{"time":29.567,"pitch":43.250},{"time":29.575,"pitch":43.198},{"time":29.583,"pitch":43.157},{"time":29.592,"pitch":43.125},{"time":29.600,"pitch":43.099},{"time":29.608,"pitch":43.079},{"time":29.617,"pitch":43.062},{"time":29.625,"pitch":43.050},{"time":29.633,"pitch":43.039},{"time":29.642,"pitch":43.031},{"time":29.650,"pitch":43.025},{"time":29.658,"pitch":43.020},{"time":29.667,"pitch":43.016},{"time":29.675,"pitch":43.012},{"time":29.683,"pitch":43.010},{"time":29.692,"pitch":43.008},{"time":29.700,"pitch":43.006},{"time":29.708,"pitch":43.005},{"time":29.717,"pitch":43.004},{"time":29.725,"pitch":43.003},{"time":29.733,"pitch":43.002},{"time":29.758,"pitch":43.001},{"time":29.792,"pitch":43.000},{"time":30.000,"pitch":42.587},{"time":30.008,"pitch":42.260},{"time":30.017,"pitch":42.000},{"time":30.025,"pitch":41.794},{"time":30.033,"pitch":41.630},{"time":30.042,"pitch":41.500},{"time":30.050,"pitch":41.397},{"time":30.058,"pitch":41.315},{"time":30.067,"pitch":41.250},{"time":30.075,"pitch":41.198},{"time":30.083,"pitch":41.157},{"time":30.092,"pitch":41.125},{"time":30.100,"pitch":41.099},{"time":30.108,"pitch":41.079},{"time":30.117,"pitch":41.063},{"time":30.125,"pitch":41.050},{"time":30.133,"pitch":41.039},{"time":30.142,"pitch":41.031},{"time":30.150,"pitch":41.025},{"time":30.158,"pitch":41.020},{"time":30.167,"pitch":41.016},{"time":30.175,"pitch":41.012},{"time":30.183,"pitch":41.010},{"time":30.192,"pitch":41.008},{"time":30.200,"pitch":41.006},{"time":30.208,"pitch":41.005},{"time":30.217,"pitch":41.004},{"time":30.225,"pitch":41.003},{"time":30.233,"pitch":41.002},{"time":30.258,"pitch":41.001},{"time":30.292,"pitch":41.000},{"time":30.758,"pitch":40.381},{"time":30.767,"pitch":39.890},{"time":30.775,"pitch":39.500},{"time":30.783,"pitch":39.191},{"time":30.792,"pitch":38.945},{"time":30.800,"pitch":38.750},{"time":30.808,"pitch":38.595},{"time":30.817,"pitch":38.472},{"time":30.825,"pitch":38.375},{"time":30.833,"pitch":38.298},{"time":30.842,"pitch":38.236},{"time":30.850,"pitch":38.188},{"time":30.858,"pitch":38.149},{"time":30.867,"pitch":38.118},{"time":30.875,"pitch":38.094},{"time":30.883,"pitch":38.074},{"time":30.892,"pitch":38.059},{"time":30.900,"pitch":38.047},{"time":30.908,"pitch":38.037},{"time":30.917,"pitch":38.030},{"time":30.925,"pitch":38.023},{"time":30.933,"pitch":38.019},{"time":30.942,"pitch":38.015},{"time":30.950,"pitch":38.012},{"time":30.958,"pitch":38.009},{"time":30.967,"pitch":38.007},{"time":30.975,"pitch":38.006},{"time":30.983,"pitch":38.005},{"time":30.992,"pitch":38.004},{"time":31.000,"pitch":38.003},{"time":31.008,"pitch":38.002},{"time":31.025,"pitch":38.001},{"time":31.067,"pitch":38.000},{"time":31.208,"pitch":36.969},{"time":31.217,"pitch":36.150},{"time":31.225,"pitch":35.500},{"time":31.233,"pitch":34.984},{"time":31.242,"pitch":34.575},{"time":31.250,"pitch":34.250},{"time":31.258,"pitch":33.992},{"time":31.267,"pitch":33.787},{"time":31.275,"pitch":33.625},{"time":31.283,"pitch":33.496},{"time":31.292,"pitch":33.394},{"time":31.300,"pitch":33.313},{"time":31.308,"pitch":33.248},{"time":31.317,"pitch":33.197},{"time":31.325,"pitch":33.156},{"time":31.333,"pitch":33.124},{"time":31.342,"pitch":33.098},{"time":31.350,"pitch":33.078},{"time":31.358,"pitch":33.062},{"time":31.367,"pitch":33.049},{"time":31.375,"pitch":33.039},{"time":31.383,"pitch":33.031},{"time":31.392,"pitch":33.025},{"time":31.400,"pitch":33.020},{"time":31.408,"pitch":33.016},{"time":31.417,"pitch":33.012},{"time":31.425,"pitch":33.010},{"time":31.433,"pitch":33.008},{"time":31.442,"pitch":33.006},{"time":31.450,"pitch":33.005},{"time":31.458,"pitch":33.004},{"time":31.467,"pitch":33.003},{"time":31.475,"pitch":33.002},{"time":31.500,"pitch":33.001},{"time":31.508,"pitch":33.620},{"time":31.517,"pitch":34.111},{"time":31.525,"pitch":34.501},{"time":31.533,"pitch":34.810},{"time":31.542,"pitch":35.055},{"time":31.550,"pitch":35.250},{"time":31.558,"pitch":35.405},{"time":31.567,"pitch":35.528},{"time":31.575,"pitch":35.625},{"time":31.583,"pitch":35.702},{"time":31.592,"pitch":35.764},{"time":31.600,"pitch":35.813},{"time":31.608,"pitch":35.851},{"time":31.617,"pitch":35.882},{"time":31.625,"pitch":35.906},{"time":31.633,"pitch":35.926},{"time":31.642,"pitch":35.941},{"time":31.650,"pitch":35.953},{"time":31.658,"pitch":35.963},{"time":31.667,"pitch":35.970},{"time":31.675,"pitch":35.977},{"time":31.683,"pitch":35.981},{"time":31.692,"pitch":35.985},{"time":31.700,"pitch":35.988},{"time":31.708,"pitch":35.991},{"time":31.717,"pitch":35.993},{"time":31.725,"pitch":35.994},{"time":31.733,"pitch":35.995},{"time":31.742,"pitch":35.996},{"time":31.750,"pitch":35.997},{"time":31.758,"pitch":35.998},{"time":31.775,"pitch":35.999},{"time":31.817,"pitch":36.000},{"time":32.000,"pitch":36.413},{"time":32.008,"pitch":36.740},{"time":32.017,"pitch":37.000},{"time":32.025,"pitch":37.206},{"time":32.033,"pitch":37.370},{"time":32.042,"pitch":37.500},{"time":32.050,"pitch":37.603},{"time":32.058,"pitch":37.685},{"time":32.067,"pitch":37.750},{"time":32.075,"pitch":37.802},{"time":32.083,"pitch":37.843},{"time":32.092,"pitch":37.875},{"time":32.100,"pitch":37.901},{"time":32.108,"pitch":37.921},{"time":32.117,"pitch":37.937},{"time":32.125,"pitch":37.950},{"time":32.133,"pitch":37.961},{"time":32.142,"pitch":37.969},{"time":32.150,"pitch":37.975},{"time":32.158,"pitch":37.980},{"time":32.167,"pitch":37.984},{"time":32.175,"pitch":37.988},{"time":32.183,"pitch":37.990},{"time":32.192,"pitch":37.992},{"time":32.200,"pitch":37.994},{"time":32.208,"pitch":37.995},{"time":32.217,"pitch":37.996},{"time":32.225,"pitch":37.997},{"time":32.233,"pitch":37.998},{"time":32.258,"pitch":37.999},{"time":32.292,"pitch":38.000},{"time":32.733,"pitch":38.619},{"time":32.742,"pitch":39.110},{"time":32.750,"pitch":39.500},{"time":32.758,"pitch":39.809},{"time":32.767,"pitch":40.055},{"time":32.775,"pitch":40.250},{"time":32.783,"pitch":40.405},{"time":32.792,"pitch":40.528},{"time":32.800,"pitch":40.625},{"time":32.808,"pitch":40.702},{"time":32.817,"pitch":40.764},{"time":32.825,"pitch":40.812},{"time":32.833,"pitch":40.851},{"time":32.842,"pitch":40.882},{"time":32.850,"pitch":40.906},{"time":32.858,"pitch":40.926},{"time":32.867,"pitch":40.941},{"time":32.875,"pitch":40.953},{"time":32.883,"pitch":40.963},{"time":32.892,"pitch":40.970},{"time":32.900,"pitch":40.977},{"time":32.908,"pitch":40.981},{"time":32.917,"pitch":40.985},{"time":32.925,"pitch":40.988},{"time":32.933,"pitch":40.991},{"time":32.942,"pitch":40.993},{"time":32.950,"pitch":40.994},{"time":32.958,"pitch":40.995},{"time":32.967,"pitch":40.996},{"time":32.975,"pitch":40.997},{"time":32.983,"pitch":40.998},{"time":33.000,"pitch":40.999},{"time":33.042,"pitch":41.000},{"time":33.258,"pitch":40.381},{"time":33.267,"pitch":39.890},{"time":33.275,"pitch":39.500},{"time":33.283,"pitch":39.191},{"time":33.292,"pitch":38.945},{"time":33.300,"pitch":38.750},{"time":33.308,"pitch":38.595},{"time":33.317,"pitch":38.472},{"time":33.325,"pitch":38.375},{"time":33.333,"pitch":38.298},{"time":33.342,"pitch":38.236},{"time":33.350,"pitch":38.187},{"time":33.358,"pitch":38.149},{"time":33.367,"pitch":38.118},{"time":33.375,"pitch":38.094},{"time":33.383,"pitch":38.074},{"time":33.392,"pitch":38.059},{"time":33.400,"pitch":38.047},{"time":33.408,"pitch":38.037},{"time":33.417,"pitch":38.030},{"time":33.425,"pitch":38.023},{"time":33.433,"pitch":38.019},{"time":33.442,"pitch":38.015},{"time":33.450,"pitch":38.012},{"time":33.458,"pitch":38.009},{"time":33.467,"pitch":38.007},{"time":33.475,"pitch":38.006},{"time":33.483,"pitch":38.005},{"time":33.492,"pitch":38.004},{"time":33.500,"pitch":38.622},{"time":33.508,"pitch":39.112},{"time":33.517,"pitch":39.502},{"time":33.525,"pitch":39.811},{"time":33.533,"pitch":40.056},{"time":33.542,"pitch":40.251},{"time":33.550,"pitch":40.405},{"time":33.558,"pitch":40.528},{"time":33.567,"pitch":40.625},{"time":33.575,"pitch":40.703},{"time":33.583,"pitch":40.764},{"time":33.592,"pitch":40.813},{"time":33.600,"pitch":40.851},{"time":33.608,"pitch":40.882},{"time":33.617,"pitch":40.906},{"time":33.625,"pitch":40.926},{"time":33.633,"pitch":40.941},{"time":33.642,"pitch":40.953},{"time":33.650,"pitch":40.963},{"time":33.658,"pitch":40.971},{"time":33.667,"pitch":40.977},{"time":33.675,"pitch":40.981},{"time":33.683,"pitch":40.985},{"time":33.692,"pitch":40.988},{"time":33.700,"pitch":40.991},{"time":33.708,"pitch":40.993},{"time":33.717,"pitch":40.994},{"time":33.725,"pitch":40.995},{"time":33.733,"pitch":40.996},{"time":33.742,"pitch":40.997},{"time":33.750,"pitch":40.998},{"time":33.767,"pitch":40.999},{"time":33.808,"pitch":41.000},{"time":34.008,"pitch":40.381},{"time":34.017,"pitch":39.890},{"time":34.025,"pitch":39.500},{"time":34.033,"pitch":39.191},{"time":34.042,"pitch":38.945},{"time":34.050,"pitch":38.750},{"time":34.058,"pitch":38.595},{"time":34.067,"pitch":38.472},{"time":34.075,"pitch":38.375},{"time":34.083,"pitch":38.298},{"time":34.092,"pitch":38.236},{"time":34.100,"pitch":38.187},{"time":34.108,"pitch":38.149},{"time":34.117,"pitch":38.118},{"time":34.125,"pitch":38.094},{"time":34.133,"pitch":38.074},{"time":34.142,"pitch":38.059},{"time":34.150,"pitch":38.047},{"time":34.158,"pitch":38.037},{"time":34.167,"pitch":38.030},{"time":34.175,"pitch":38.023},{"time":34.183,"pitch":38.019},{"time":34.192,"pitch":38.015},{"time":34.200,"pitch":38.012},{"time":34.208,"pitch":38.009},{"time":34.217,"pitch":38.007},{"time":34.225,"pitch":38.006},{"time":34.233,"pitch":38.005},{"time":34.242,"pitch":38.004},{"time":34.250,"pitch":38.003},{"time":34.258,"pitch":38.002},{"time":34.275,"pitch":38.001},{"time":34.317,"pitch":38.000},{"time":34.758,"pitch":37.587},{"time":34.767,"pitch":37.260},{"time":34.775,"pitch":37.000},{"time":34.783,"pitch":36.794},{"time":34.792,"pitch":36.630},{"time":34.800,"pitch":36.500},{"time":34.808,"pitch":36.397},{"time":34.817,"pitch":36.315},{"time":34.825,"pitch":36.250},{"time":34.833,"pitch":36.198},{"time":34.842,"pitch":36.157},{"time":34.850,"pitch":36.125},{"time":34.858,"pitch":36.099},{"time":34.867,"pitch":36.079},{"time":34.875,"pitch":36.063},{"time":34.883,"pitch":36.050},{"time":34.892,"pitch":36.039},{"time":34.900,"pitch":36.031},{"time":34.908,"pitch":36.025},{"time":34.917,"pitch":36.020},{"time":34.925,"pitch":36.016},{"time":34.933,"pitch":36.012},{"time":34.942,"pitch":36.010},{"time":34.950,"pitch":36.008},{"time":34.958,"pitch":36.006},{"time":34.967,"pitch":36.005},{"time":34.975,"pitch":36.004},{"time":34.983,"pitch":36.003},{"time":34.992,"pitch":36.002},{"time":35.017,"pitch":36.001},{"time":35.050,"pitch":36.000},{"time":35.258,"pitch":35.381},{"time":35.267,"pitch":34.890},{"time":35.275,"pitch":34.500},{"time":35.283,"pitch":34.191},{"time":35.292,"pitch":33.945},{"time":35.300,"pitch":33.750},{"time":35.308,"pitch":33.595},{"time":35.317,"pitch":33.472},{"time":35.325,"pitch":33.375},{"time":35.333,"pitch":33.298},{"time":35.342,"pitch":33.236},{"time":35.350,"pitch":33.188},{"time":35.358,"pitch":33.149},{"time":35.367,"pitch":33.118},{"time":35.375,"pitch":33.094},{"time":35.383,"pitch":33.074},{"time":35.392,"pitch":33.059},{"time":35.400,"pitch":33.047},{"time":35.408,"pitch":33.037},{"time":35.417,"pitch":33.030},{"time":35.425,"pitch":33.023},{"time":35.433,"pitch":33.019},{"time":35.442,"pitch":33.015},{"time":35.450,"pitch":33.012},{"time":35.458,"pitch":33.009},{"time":35.467,"pitch":33.007},{"time":35.475,"pitch":33.006},{"time":35.483,"pitch":33.005},{"time":35.492,"pitch":33.004},{"time":35.500,"pitch":33.003},{"time":35.508,"pitch":33.621},{"time":35.517,"pitch":34.112},{"time":35.525,"pitch":34.501},{"time":35.533,"pitch":34.811},{"time":35.542,"pitch":35.056},{"time":35.550,"pitch":35.251},{"time":35.558,"pitch":35.405},{"time":35.567,"pitch":35.528},{"time":35.575,"pitch":35.625},{"time":35.583,"pitch":35.703},{"time":35.592,"pitch":35.764},{"time":35.600,"pitch":35.813},{"time":35.608,"pitch":35.851},{"time":35.617,"pitch":35.882},{"time":35.625,"pitch":35.906},{"time":35.633,"pitch":35.926},{"time":35.642,"pitch":35.941},{"time":35.650,"pitch":35.953},{"time":35.658,"pitch":35.963},{"time":35.667,"pitch":35.970},{"time":35.675,"pitch":35.977},{"time":35.683,"pitch":35.981},{"time":35.692,"pitch":35.985},{"time":35.700,"pitch":35.988},{"time":35.708,"pitch":35.991},{"time":35.717,"pitch":35.993},{"time":35.725,"pitch":35.994},{"time":35.733,"pitch":35.995},{"time":35.742,"pitch":35.996},{"time":35.750,"pitch":35.997},{"time":35.758,"pitch":35.998},{"time":35.775,"pitch":35.999},{"time":35.817,"pitch":36.000},{"time":36.000,"pitch":36.413},{"time":36.008,"pitch":36.740},{"time":36.017,"pitch":37.000},{"time":36.025,"pitch":37.206},{"time":36.033,"pitch":37.370},{"time":36.042,"pitch":37.500},{"time":36.050,"pitch":37.603},{"time":36.058,"pitch":37.685},{"time":36.067,"pitch":37.750},{"time":36.075,"pitch":37.802},{"time":36.083,"pitch":37.843},{"time":36.092,"pitch":37.875},{"time":36.100,"pitch":37.901},{"time":36.108,"pitch":37.921},{"time":36.117,"pitch":37.937},{"time":36.125,"pitch":37.950},{"time":36.133,"pitch":37.961},{"time":36.142,"pitch":37.969},{"time":36.150,"pitch":37.975},{"time":36.158,"pitch":37.980},{"time":36.167,"pitch":37.984},{"time":36.175,"pitch":37.988},{"time":36.183,"pitch":37.990},{"time":36.192,"pitch":37.992},{"time":36.200,"pitch":37.994},{"time":36.208,"pitch":37.995},{"time":36.217,"pitch":37.996},{"time":36.225,"pitch":37.997},{"time":36.233,"pitch":37.998},{"time":36.258,"pitch":37.999},{"time":36.292,"pitch":38.000},{"time":36.733,"pitch":38.619},{"time":36.742,"pitch":39.110},{"time":36.750,"pitch":39.500},{"time":36.758,"pitch":39.809},{"time":36.767,"pitch":40.055},{"time":36.775,"pitch":40.250},{"time":36.783,"pitch":40.405},{"time":36.792,"pitch":40.528},{"time":36.800,"pitch":40.625},{"time":36.808,"pitch":40.702},{"time":36.817,"pitch":40.764},{"time":36.825,"pitch":40.812},{"time":36.833,"pitch":40.851},{"time":36.842,"pitch":40.882},{"time":36.850,"pitch":40.906},{"time":36.858,"pitch":40.926},{"time":36.867,"pitch":40.941},{"time":36.875,"pitch":40.953},{"time":36.883,"pitch":40.963},{"time":36.892,"pitch":40.970},{"time":36.900,"pitch":40.977},{"time":36.908,"pitch":40.981},{"time":36.917,"pitch":40.985},{"time":36.925,"pitch":40.988},{"time":36.933,"pitch":40.991},{"time":36.942,"pitch":40.993},{"time":36.950,"pitch":40.994},{"time":36.958,"pitch":40.995},{"time":36.967,"pitch":40.996},{"time":36.975,"pitch":40.997},{"time":36.983,"pitch":40.998},{"time":37.000,"pitch":40.999},{"time":37.042,"pitch":41.000},{"time":37.258,"pitch":40.381},{"time":37.267,"pitch":39.890},{"time":37.275,"pitch":39.500},{"time":37.283,"pitch":39.191},{"time":37.292,"pitch":38.945},{"time":37.300,"pitch":38.750},{"time":37.308,"pitch":38.595},{"time":37.317,"pitch":38.472},{"time":37.325,"pitch":38.375},{"time":37.333,"pitch":38.298},{"time":37.342,"pitch":38.236},{"time":37.350,"pitch":38.187},{"time":37.358,"pitch":38.149},{"time":37.367,"pitch":38.118},{"time":37.375,"pitch":38.094},{"time":37.383,"pitch":38.074},{"time":37.392,"pitch":38.059},{"time":37.400,"pitch":38.047},{"time":37.408,"pitch":38.037},{"time":37.417,"pitch":38.030},{"time":37.425,"pitch":38.023},{"time":37.433,"pitch":38.019},{"time":37.442,"pitch":38.015},{"time":37.450,"pitch":38.012},{"time":37.458,"pitch":38.009},{"time":37.467,"pitch":38.007},{"time":37.475,"pitch":38.006},{"time":37.483,"pitch":38.005},{"time":37.492,"pitch":38.004},{"time":37.500,"pitch":38.622},{"time":37.508,"pitch":39.112},{"time":37.517,"pitch":39.502},{"time":37.525,"pitch":39.811},{"time":37.533,"pitch":40.056},{"time":37.542,"pitch":40.251},{"time":37.550,"pitch":40.405},{"time":37.558,"pitch":40.528},{"time":37.567,"pitch":40.625},{"time":37.575,"pitch":40.703},{"time":37.583,"pitch":40.764},{"time":37.592,"pitch":40.813},{"time":37.600,"pitch":40.851},{"time":37.608,"pitch":40.882},{"time":37.617,"pitch":40.906},{"time":37.625,"pitch":40.926},{"time":37.633,"pitch":40.941},{"time":37.642,"pitch":40.953},{"time":37.650,"pitch":40.963},{"time":37.658,"pitch":40.971},{"time":37.667,"pitch":40.977},{"time":37.675,"pitch":40.981},{"time":37.683,"pitch":40.985},{"time":37.692,"pitch":40.988},{"time":37.700,"pitch":40.991},{"time":37.708,"pitch":40.993},{"time":37.717,"pitch":40.994},{"time":37.725,"pitch":40.995},{"time":37.733,"pitch":40.996},{"time":37.742,"pitch":40.997},{"time":37.750,"pitch":40.998},{"time":37.767,"pitch":40.999},{"time":37.808,"pitch":41.000},{"time":38.008,"pitch":40.381},{"time":38.017,"pitch":39.890},{"time":38.025,"pitch":39.500},{"time":38.033,"pitch":39.191},{"time":38.042,"pitch":38.945},{"time":38.050,"pitch":38.750},{"time":38.058,"pitch":38.595},{"time":38.067,"pitch":38.472},{"time":38.075,"pitch":38.375},{"time":38.083,"pitch":38.298},{"time":38.092,"pitch":38.236},{"time":38.100,"pitch":38.187},{"time":38.108,"pitch":38.149},{"time":38.117,"pitch":38.118},{"time":38.125,"pitch":38.094},{"time":38.133,"pitch":38.074},{"time":38.142,"pitch":38.059},{"time":38.150,"pitch":38.047},{"time":38.158,"pitch":38.037},{"time":38.167,"pitch":38.030},{"time":38.175,"pitch":38.023},{"time":38.183,"pitch":38.019},{"time":38.192,"pitch":38.015},{"time":38.200,"pitch":38.012},{"time":38.208,"pitch":38.009},{"time":38.217,"pitch":38.007},{"time":38.225,"pitch":38.006},{"time":38.233,"pitch":38.005},{"time":38.242,"pitch":38.004},{"time":38.250,"pitch":38.003},{"time":38.258,"pitch":38.002},{"time":38.275,"pitch":38.001},{"time":38.317,"pitch":38.000},{"time":38.758,"pitch":37.587},{"time":38.767,"pitch":37.260},{"time":38.775,"pitch":37.000},{"time":38.783,"pitch":36.794},{"time":38.792,"pitch":36.630},{"time":38.800,"pitch":36.500},{"time":38.808,"pitch":36.397},{"time":38.817,"pitch":36.315},{"time":38.825,"pitch":36.250},{"time":38.833,"pitch":36.198},{"time":38.842,"pitch":36.157},{"time":38.850,"pitch":36.125},{"time":38.858,"pitch":36.099},{"time":38.867,"pitch":36.079},{"time":38.875,"pitch":36.063},{"time":38.883,"pitch":36.050},{"time":38.892,"pitch":36.039},{"time":38.900,"pitch":36.031},{"time":38.908,"pitch":36.025},{"time":38.917,"pitch":36.020},{"time":38.925,"pitch":36.016},{"time":38.933,"pitch":36.012},{"time":38.942,"pitch":36.010},{"time":38.950,"pitch":36.008},{"time":38.958,"pitch":36.006},{"time":38.967,"pitch":36.005},{"time":38.975,"pitch":36.004},{"time":38.983,"pitch":36.003},{"time":38.992,"pitch":36.002},{"time":39.017,"pitch":36.001},{"time":39.050,"pitch":36.000},{"time":39.258,"pitch":35.381},{"time":39.267,"pitch":34.890},{"time":39.275,"pitch":34.500},{"time":39.283,"pitch":34.191},{"time":39.292,"pitch":33.945},{"time":39.300,"pitch":33.750},{"time":39.308,"pitch":33.595},{"time":39.317,"pitch":33.472},{"time":39.325,"pitch":33.375},{"time":39.333,"pitch":33.298},{"time":39.342,"pitch":33.236},{"time":39.350,"pitch":33.188},{"time":39.358,"pitch":33.149},{"time":39.367,"pitch":33.118},{"time":39.375,"pitch":33.094},{"time":39.383,"pitch":33.074},{"time":39.392,"pitch":33.059},{"time":39.400,"pitch":33.047},{"time":39.408,"pitch":33.037},{"time":39.417,"pitch":33.030},{"time":39.425,"pitch":33.023},{"time":39.433,"pitch":33.019},{"time":39.442,"pitch":33.015},{"time":39.450,"pitch":33.012},{"time":39.458,"pitch":33.009},{"time":39.467,"pitch":33.007},{"time":39.475,"pitch":33.006},{"time":39.483,"pitch":33.005},{"time":39.492,"pitch":33.004},{"time":39.500,"pitch":33.003},{"time":39.508,"pitch":33.621},{"time":39.517,"pitch":34.112},{"time":39.525,"pitch":34.501},{"time":39.533,"pitch":34.811},{"time":39.542,"pitch":35.056},{"time":39.550,"pitch":35.251},{"time":39.558,"pitch":35.405},{"time":39.567,"pitch":35.528},{"time":39.575,"pitch":35.625},{"time":39.583,"pitch":35.703},{"time":39.592,"pitch":35.764},{"time":39.600,"pitch":35.813},{"time":39.608,"pitch":35.851},{"time":39.617,"pitch":35.882},{"time":39.625,"pitch":35.906},{"time":39.633,"pitch":35.926},{"time":39.642,"pitch":35.941},{"time":39.650,"pitch":35.953},{"time":39.658,"pitch":35.963},{"time":39.667,"pitch":35.970},{"time":39.675,"pitch":35.977},{"time":39.683,"pitch":35.981},{"time":39.692,"pitch":35.985},{"time":39.700,"pitch":35.988},{"time":39.708,"pitch":35.991},{"time":39.717,"pitch":35.993},{"time":39.725,"pitch":35.994},{"time":39.733,"pitch":35.995},{"time":39.742,"pitch":35.996},{"time":39.750,"pitch":35.997},{"time":39.758,"pitch":35.998},{"time":39.775,"pitch":35.999},{"time":39.817,"pitch":36.000},{"time":40.000,"pitch":36.413},{"time":40.008,"pitch":36.740},{"time":40.017,"pitch":37.000},{"time":40.025,"pitch":37.206},{"time":40.033,"pitch":37.370},{"time":40.042,"pitch":37.500},{"time":40.050,"pitch":37.603},{"time":40.058,"pitch":37.685},{"time":40.067,"pitch":37.750},{"time":40.075,"pitch":37.802},{"time":40.083,"pitch":37.843},{"time":40.092,"pitch":37.875},{"time":40.100,"pitch":37.901},{"time":40.108,"pitch":37.921},{"time":40.117,"pitch":37.937},{"time":40.125,"pitch":37.950},{"time":40.133,"pitch":37.961},{"time":40.142,"pitch":37.969},{"time":40.150,"pitch":37.975},{"time":40.158,"pitch":37.980},{"time":40.167,"pitch":37.984},{"time":40.175,"pitch":37.988},{"time":40.183,"pitch":37.990},{"time":40.192,"pitch":37.992},{"time":40.200,"pitch":37.994},{"time":40.208,"pitch":37.995},{"time":40.217,"pitch":37.996},{"time":40.225,"pitch":37.997},{"time":40.233,"pitch":37.998},{"time":40.258,"pitch":37.999},{"time":40.292,"pitch":38.000},{"time":40.733,"pitch":38.619},{"time":40.742,"pitch":39.110},{"time":40.750,"pitch":39.500},{"time":40.758,"pitch":39.809},{"time":40.767,"pitch":40.055},{"time":40.775,"pitch":40.250},{"time":40.783,"pitch":40.405},{"time":40.792,"pitch":40.528},{"time":40.800,"pitch":40.625},{"time":40.808,"pitch":40.702},{"time":40.817,"pitch":40.764},{"time":40.825,"pitch":40.812},{"time":40.833,"pitch":40.851},{"time":40.842,"pitch":40.882},{"time":40.850,"pitch":40.906},{"time":40.858,"pitch":40.926},{"time":40.867,"pitch":40.941},{"time":40.875,"pitch":40.953},{"time":40.883,"pitch":40.963},{"time":40.892,"pitch":40.970},{"time":40.900,"pitch":40.977},{"time":40.908,"pitch":40.981},{"time":40.917,"pitch":40.985},{"time":40.925,"pitch":40.988},{"time":40.933,"pitch":40.991},{"time":40.942,"pitch":40.993},{"time":40.950,"pitch":40.994},{"time":40.958,"pitch":40.995},{"time":40.967,"pitch":40.996},{"time":40.975,"pitch":40.997},{"time":40.983,"pitch":40.998},{"time":41.000,"pitch":40.999},{"time":41.042,"pitch":41.000},{"time":41.258,"pitch":40.381},{"time":41.267,"pitch":39.890},{"time":41.275,"pitch":39.500},{"time":41.283,"pitch":39.191},{"time":41.292,"pitch":38.945},{"time":41.300,"pitch":38.750},{"time":41.308,"pitch":38.595},{"time":41.317,"pitch":38.472},{"time":41.325,"pitch":38.375},{"time":41.333,"pitch":38.298},{"time":41.342,"pitch":38.236},{"time":41.350,"pitch":38.187},{"time":41.358,"pitch":38.149},{"time":41.367,"pitch":38.118},{"time":41.375,"pitch":38.094},{"time":41.383,"pitch":38.074},{"time":41.392,"pitch":38.059},{"time":41.400,"pitch":38.047},{"time":41.408,"pitch":38.037},{"time":41.417,"pitch":38.030},{"time":41.425,"pitch":38.023},{"time":41.433,"pitch":38.019},{"time":41.442,"pitch":38.015},{"time":41.450,"pitch":38.012},{"time":41.458,"pitch":38.009},{"time":41.467,"pitch":38.007},{"time":41.475,"pitch":38.006},{"time":41.483,"pitch":38.005},{"time":41.492,"pitch":38.004},{"time":41.500,"pitch":38.622},{"time":41.508,"pitch":39.112},{"time":41.517,"pitch":39.502},{"time":41.525,"pitch":39.811},{"time":41.533,"pitch":40.056},{"time":41.542,"pitch":40.251},{"time":41.550,"pitch":40.405},{"time":41.558,"pitch":40.528},{"time":41.567,"pitch":40.625},{"time":41.575,"pitch":40.703},{"time":41.583,"pitch":40.764},{"time":41.592,"pitch":40.813},{"time":41.600,"pitch":40.851},{"time":41.608,"pitch":40.882},{"time":41.617,"pitch":40.906},{"time":41.625,"pitch":40.926},{"time":41.633,"pitch":40.941},{"time":41.642,"pitch":40.953},{"time":41.650,"pitch":40.963},{"time":41.658,"pitch":40.971},{"time":41.667,"pitch":40.977},{"time":41.675,"pitch":40.981},{"time":41.683,"pitch":40.985},{"time":41.692,"pitch":40.988},{"time":41.700,"pitch":40.991},{"time":41.708,"pitch":40.993},{"time":41.717,"pitch":40.994},{"time":41.725,"pitch":40.995},{"time":41.733,"pitch":40.996},{"time":41.742,"pitch":40.997},{"time":41.750,"pitch":40.998},{"time":41.767,"pitch":40.999},{"time":41.808,"pitch":41.000},{"time":42.008,"pitch":40.381},{"time":42.017,"pitch":39.890},{"time":42.025,"pitch":39.500},{"time":42.033,"pitch":39.191},{"time":42.042,"pitch":38.945},{"time":42.050,"pitch":38.750},{"time":42.058,"pitch":38.595},{"time":42.067,"pitch":38.472},{"time":42.075,"pitch":38.375},{"time":42.083,"pitch":38.298},{"time":42.092,"pitch":38.236},{"time":42.100,"pitch":38.187},{"time":42.108,"pitch":38.149},{"time":42.117,"pitch":38.118},{"time":42.125,"pitch":38.094},{"time":42.133,"pitch":38.074},{"time":42.142,"pitch":38.059},{"time":42.150,"pitch":38.047},{"time":42.158,"pitch":38.037},{"time":42.167,"pitch":38.030},{"time":42.175,"pitch":38.023},{"time":42.183,"pitch":38.019},{"time":42.192,"pitch":38.015},{"time":42.200,"pitch":38.012},{"time":42.208,"pitch":38.009},{"time":42.217,"pitch":38.007},{"time":42.225,"pitch":38.006},{"time":42.233,"pitch":38.005},{"time":42.242,"pitch":38.004},{"time":42.250,"pitch":38.003},{"time":42.258,"pitch":38.002},{"time":42.275,"pitch":38.001},{"time":42.317,"pitch":38.000},{"time":42.758,"pitch":37.587},{"time":42.767,"pitch":37.260},{"time":42.775,"pitch":37.000},{"time":42.783,"pitch":36.794},{"time":42.792,"pitch":36.630},{"time":42.800,"pitch":36.500},{"time":42.808,"pitch":36.397},{"time":42.817,"pitch":36.315},{"time":42.825,"pitch":36.250},{"time":42.833,"pitch":36.198},{"time":42.842,"pitch":36.157},{"time":42.850,"pitch":36.125},{"time":42.858,"pitch":36.099},{"time":42.867,"pitch":36.079},{"time":42.875,"pitch":36.063},{"time":42.883,"pitch":36.050},{"time":42.892,"pitch":36.039},{"time":42.900,"pitch":36.031},{"time":42.908,"pitch":36.025},{"time":42.917,"pitch":36.020},{"time":42.925,"pitch":36.016},{"time":42.933,"pitch":36.012},{"time":42.942,"pitch":36.010},{"time":42.950,"pitch":36.008},{"time":42.958,"pitch":36.006},{"time":42.967,"pitch":36.005},{"time":42.975,"pitch":36.004},{"time":42.983,"pitch":36.003},{"time":42.992,"pitch":36.002},{"time":43.017,"pitch":36.001},{"time":43.050,"pitch":36.000},{"time":43.258,"pitch":35.381},{"time":43.267,"pitch":34.890},{"time":43.275,"pitch":34.500},{"time":43.283,"pitch":34.191},{"time":43.292,"pitch":33.945},{"time":43.300,"pitch":33.750},{"time":43.308,"pitch":33.595},{"time":43.317,"pitch":33.472},{"time":43.325,"pitch":33.375},{"time":43.333,"pitch":33.298},{"time":43.342,"pitch":33.236},{"time":43.350,"pitch":33.188},{"time":43.358,"pitch":33.149},{"time":43.367,"pitch":33.118},{"time":43.375,"pitch":33.094},{"time":43.383,"pitch":33.074},{"time":43.392,"pitch":33.059},{"time":43.400,"pitch":33.047},{"time":43.408,"pitch":33.037},{"time":43.417,"pitch":33.030},{"time":43.425,"pitch":33.023},{"time":43.433,"pitch":33.019},{"time":43.442,"pitch":33.015},{"time":43.450,"pitch":33.012},{"time":43.458,"pitch":33.009},{"time":43.467,"pitch":33.007},{"time":43.475,"pitch":33.006},{"time":43.483,"pitch":33.005},{"time":43.492,"pitch":33.004},{"time":43.500,"pitch":33.003},{"time":43.508,"pitch":33.621},{"time":43.517,"pitch":34.112},{"time":43.525,"pitch":34.501},{"time":43.533,"pitch":34.811},{"time":43.542,"pitch":35.056},{"time":43.550,"pitch":35.251},{"time":43.558,"pitch":35.405},{"time":43.567,"pitch":35.528},{"time":43.575,"pitch":35.625},{"time":43.583,"pitch":35.703},{"time":43.592,"pitch":35.764},{"time":43.600,"pitch":35.813},{"time":43.608,"pitch":35.851},{"time":43.617,"pitch":35.882},{"time":43.625,"pitch":35.906},{"time":43.633,"pitch":35.926},{"time":43.642,"pitch":35.941},{"time":43.650,"pitch":35.953},{"time":43.658,"pitch":35.963},{"time":43.667,"pitch":35.970},{"time":43.675,"pitch":35.977},{"time":43.683,"pitch":35.981},{"time":43.692,"pitch":35.985},{"time":43.700,"pitch":35.988},{"time":43.708,"pitch":35.991},{"time":43.717,"pitch":35.993},{"time":43.725,"pitch":35.994},{"time":43.733,"pitch":35.995},{"time":43.742,"pitch":35.996},{"time":43.750,"pitch":35.997},{"time":43.758,"pitch":35.998},{"time":43.775,"pitch":35.999},{"time":43.817,"pitch":36.000},{"time":44.000,"pitch":36.413},{"time":44.008,"pitch":36.740},{"time":44.017,"pitch":37.000},{"time":44.025,"pitch":37.206},{"time":44.033,"pitch":37.370},{"time":44.042,"pitch":37.500},{"time":44.050,"pitch":37.603},{"time":44.058,"pitch":37.685},{"time":44.067,"pitch":37.750},{"time":44.075,"pitch":37.802},{"time":44.083,"pitch":37.843},{"time":44.092,"pitch":37.875},{"time":44.100,"pitch":37.901},{"time":44.108,"pitch":37.921},{"time":44.117,"pitch":37.937},{"time":44.125,"pitch":37.950},{"time":44.133,"pitch":37.961},{"time":44.142,"pitch":37.969},{"time":44.150,"pitch":37.975},{"time":44.158,"pitch":37.980},{"time":44.167,"pitch":37.984},{"time":44.175,"pitch":37.988},{"time":44.183,"pitch":37.990},{"time":44.192,"pitch":37.992},{"time":44.200,"pitch":37.994},{"time":44.208,"pitch":37.995},{"time":44.217,"pitch":37.996},{"time":44.225,"pitch":37.997},{"time":44.233,"pitch":37.998},{"time":44.258,"pitch":37.999},{"time":44.292,"pitch":38.000},{"time":44.733,"pitch":38.619},{"time":44.742,"pitch":39.110},{"time":44.750,"pitch":39.500},{"time":44.758,"pitch":39.809},{"time":44.767,"pitch":40.055},{"time":44.775,"pitch":40.250},{"time":44.783,"pitch":40.405},{"time":44.792,"pitch":40.528},{"time":44.800,"pitch":40.625},{"time":44.808,"pitch":40.702},{"time":44.817,"pitch":40.764},{"time":44.825,"pitch":40.812},{"time":44.833,"pitch":40.851},{"time":44.842,"pitch":40.882},{"time":44.850,"pitch":40.906},{"time":44.858,"pitch":40.926},{"time":44.867,"pitch":40.941},{"time":44.875,"pitch":40.953},{"time":44.883,"pitch":40.963},{"time":44.892,"pitch":40.970},{"time":44.900,"pitch":40.977},{"time":44.908,"pitch":40.981},{"time":44.917,"pitch":40.985},{"time":44.925,"pitch":40.988},{"time":44.933,"pitch":40.991},{"time":44.942,"pitch":40.993},{"time":44.950,"pitch":40.994},{"time":44.958,"pitch":40.995},{"time":44.967,"pitch":40.996},{"time":44.975,"pitch":40.997},{"time":44.983,"pitch":40.998},{"time":45.000,"pitch":40.999},{"time":45.042,"pitch":41.000},{"time":45.225,"pitch":41.619},{"time":45.233,"pitch":42.110},{"time":45.242,"pitch":42.500},{"time":45.250,"pitch":42.809},{"time":45.258,"pitch":43.055},{"time":45.267,"pitch":43.250},{"time":45.275,"pitch":43.405},{"time":45.283,"pitch":43.528},{"time":45.292,"pitch":43.625},{"time":45.300,"pitch":43.702},{"time":45.308,"pitch":43.764},{"time":45.317,"pitch":43.812},{"time":45.325,"pitch":43.851},{"time":45.333,"pitch":43.882},{"time":45.342,"pitch":43.906},{"time":45.350,"pitch":43.926},{"time":45.358,"pitch":43.941},{"time":45.367,"pitch":43.953},{"time":45.375,"pitch":43.963},{"time":45.383,"pitch":43.970},{"time":45.392,"pitch":43.977},{"time":45.400,"pitch":43.981},{"time":45.408,"pitch":43.985},{"time":45.417,"pitch":43.988},{"time":45.425,"pitch":43.991},{"time":45.433,"pitch":43.993},{"time":45.442,"pitch":43.994},{"time":45.450,"pitch":43.995},{"time":45.458,"pitch":43.996},{"time":45.467,"pitch":43.997},{"time":45.475,"pitch":43.998},{"time":45.492,"pitch":43.999},{"time":45.525,"pitch":43.793},{"time":45.533,"pitch":43.629},{"time":45.542,"pitch":43.500},{"time":45.550,"pitch":43.397},{"time":45.558,"pitch":43.315},{"time":45.567,"pitch":43.250},{"time":45.575,"pitch":43.198},{"time":45.583,"pitch":43.157},{"time":45.592,"pitch":43.125},{"time":45.600,"pitch":43.099},{"time":45.608,"pitch":43.079},{"time":45.617,"pitch":43.062},{"time":45.625,"pitch":43.050},{"time":45.633,"pitch":43.039},{"time":45.642,"pitch":43.031},{"time":45.650,"pitch":43.025},{"time":45.658,"pitch":43.020},{"time":45.667,"pitch":43.016},{"time":45.675,"pitch":43.012},{"time":45.683,"pitch":43.010},{"time":45.692,"pitch":43.008},{"time":45.700,"pitch":43.006},{"time":45.708,"pitch":43.005},{"time":45.717,"pitch":43.004},{"time":45.725,"pitch":43.003},{"time":45.733,"pitch":43.002},{"time":45.758,"pitch":43.001},{"time":45.792,"pitch":43.000},{"time":46.000,"pitch":42.587},{"time":46.008,"pitch":42.260},{"time":46.017,"pitch":42.000},{"time":46.025,"pitch":41.794},{"time":46.033,"pitch":41.630},{"time":46.042,"pitch":41.500},{"time":46.050,"pitch":41.397},{"time":46.058,"pitch":41.315},{"time":46.067,"pitch":41.250},{"time":46.075,"pitch":41.198},{"time":46.083,"pitch":41.157},{"time":46.092,"pitch":41.125},{"time":46.100,"pitch":41.099},{"time":46.108,"pitch":41.079},{"time":46.117,"pitch":41.063},{"time":46.125,"pitch":41.050},{"time":46.133,"pitch":41.039},{"time":46.142,"pitch":41.031},{"time":46.150,"pitch":41.025},{"time":46.158,"pitch":41.020},{"time":46.167,"pitch":41.016},{"time":46.175,"pitch":41.012},{"time":46.183,"pitch":41.010},{"time":46.192,"pitch":41.008},{"time":46.200,"pitch":41.006},{"time":46.208,"pitch":41.005},{"time":46.217,"pitch":41.004},{"time":46.225,"pitch":41.003},{"time":46.233,"pitch":41.002},{"time":46.258,"pitch":41.001},{"time":46.292,"pitch":41.000},{"time":46.758,"pitch":40.381},{"time":46.767,"pitch":39.890},{"time":46.775,"pitch":39.500},{"time":46.783,"pitch":39.191},{"time":46.792,"pitch":38.945},{"time":46.800,"pitch":38.750},{"time":46.808,"pitch":38.595},{"time":46.817,"pitch":38.472},{"time":46.825,"pitch":38.375},{"time":46.833,"pitch":38.298},{"time":46.842,"pitch":38.236},{"time":46.850,"pitch":38.188},{"time":46.858,"pitch":38.149},{"time":46.867,"pitch":38.118},{"time":46.875,"pitch":38.094},{"time":46.883,"pitch":38.074},{"time":46.892,"pitch":38.059},{"time":46.900,"pitch":38.047},{"time":46.908,"pitch":38.037},{"time":46.917,"pitch":38.030},{"time":46.925,"pitch":38.023},{"time":46.933,"pitch":38.019},{"time":46.942,"pitch":38.015},{"time":46.950,"pitch":38.012},{"time":46.958,"pitch":38.009},{"time":46.967,"pitch":38.007},{"time":46.975,"pitch":38.006},{"time":46.983,"pitch":38.005},{"time":46.992,"pitch":38.004},{"time":47.000,"pitch":38.003},{"time":47.008,"pitch":38.002},{"time":47.025,"pitch":38.001},{"time":47.067,"pitch":38.000},{"time":47.208,"pitch":36.969},{"time":47.217,"pitch":36.150},{"time":47.225,"pitch":35.500},{"time":47.233,"pitch":34.984},{"time":47.242,"pitch":34.575},{"time":47.250,"pitch":34.250},{"time":47.258,"pitch":33.992},{"time":47.267,"pitch":33.787},{"time":47.275,"pitch":33.625},{"time":47.283,"pitch":33.496},{"time":47.292,"pitch":33.394},{"time":47.300,"pitch":33.313},{"time":47.308,"pitch":33.248},{"time":47.317,"pitch":33.197},{"time":47.325,"pitch":33.156},{"time":47.333,"pitch":33.124},{"time":47.342,"pitch":33.098},{"time":47.350,"pitch":33.078},{"time":47.358,"pitch":33.062},{"time":47.367,"pitch":33.049},{"time":47.375,"pitch":33.039},{"time":47.383,"pitch":33.031},{"time":47.392,"pitch":33.025},{"time":47.400,"pitch":33.020},{"time":47.408,"pitch":33.016},{"time":47.417,"pitch":33.012},{"time":47.425,"pitch":33.010},{"time":47.433,"pitch":33.008},{"time":47.442,"pitch":33.006},{"time":47.450,"pitch":33.005},{"time":47.458,"pitch":33.004},{"time":47.467,"pitch":33.003},{"time":47.475,"pitch":33.002},{"time":47.500,"pitch":33.001},{"time":47.508,"pitch":33.620},{"time":47.517,"pitch":34.111},{"time":47.525,"pitch":34.501},{"time":47.533,"pitch":34.810},{"time":47.542,"pitch":35.055},{"time":47.550,"pitch":35.250},{"time":47.558,"pitch":35.405},{"time":47.567,"pitch":35.528},{"time":47.575,"pitch":35.625},{"time":47.583,"pitch":35.702},{"time":47.592,"pitch":35.764},{"time":47.600,"pitch":35.813},{"time":47.608,"pitch":35.851},{"time":47.617,"pitch":35.882},{"time":47.625,"pitch":35.906},{"time":47.633,"pitch":35.926},{"time":47.642,"pitch":35.941},{"time":47.650,"pitch":35.953},{"time":47.658,"pitch":35.963},{"time":47.667,"pitch":35.970},{"time":47.675,"pitch":35.977},{"time":47.683,"pitch":35.981},{"time":47.692,"pitch":35.985},{"time":47.700,"pitch":35.988},{"time":47.708,"pitch":35.991},{"time":47.717,"pitch":35.993},{"time":47.725,"pitch":35.994},{"time":47.733,"pitch":35.995},{"time":47.742,"pitch":35.996},{"time":47.750,"pitch":35.997},{"time":47.758,"pitch":35.998},{"time":47.775,"pitch":35.999},{"time":47.817,"pitch":36.000},{"time":48.000,"pitch":36.413},{"time":48.008,"pitch":36.740},{"time":48.017,"pitch":37.000},{"time":48.025,"pitch":37.206},{"time":48.033,"pitch":37.370},{"time":48.042,"pitch":37.500},{"time":48.050,"pitch":37.603},{"time":48.058,"pitch":37.685},{"time":48.067,"pitch":37.750},{"time":48.075,"pitch":37.802},{"time":48.083,"pitch":37.843},{"time":48.092,"pitch":37.875},{"time":48.100,"pitch":37.901},{"time":48.108,"pitch":37.921},{"time":48.117,"pitch":37.937},{"time":48.125,"pitch":37.950},{"time":48.133,"pitch":37.961},{"time":48.142,"pitch":37.969},{"time":48.150,"pitch":37.975},{"time":48.158,"pitch":37.980},{"time":48.167,"pitch":37.984},{"time":48.175,"pitch":37.988},{"time":48.183,"pitch":37.990},{"time":48.192,"pitch":37.992},{"time":48.200,"pitch":37.994},{"time":48.208,"pitch":37.995},{"time":48.217,"pitch":37.996},{"time":48.225,"pitch":37.997},{"time":48.233,"pitch":37.998},{"time":48.258,"pitch":37.999},{"time":48.292,"pitch":38.000},{"time":48.317,"volume":0.833},{"time":48.325,"volume":0.667},{"time":48.333,"volume":0.500},{"time":48.342,"volume":0.333},{"time":48.350,"volume":0.167},{"time":48.358,"volume":0.000},{"time":48.367,"volume":0}]}},{"noteOn":{"time":127.000,"k":[{"time":-0.000,"pitch":38.000,"volume":0.167},{"time":0.008,"pitch":38.000,"volume":0.333},{"time":0.017,"volume":0.500},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1.000},{"time":0.733,"pitch":38.619},{"time":0.742,"pitch":39.110},{"time":0.750,"pitch":39.500},{"time":0.758,"pitch":39.809},{"time":0.767,"pitch":40.055},{"time":0.775,"pitch":40.250},{"time":0.783,"pitch":40.405},{"time":0.792,"pitch":40.528},{"time":0.800,"pitch":40.625},{"time":0.808,"pitch":40.702},{"time":0.817,"pitch":40.764},{"time":0.825,"pitch":40.813},{"time":0.833,"pitch":40.851},{"time":0.842,"pitch":40.882},{"time":0.850,"pitch":40.906},{"time":0.858,"pitch":40.926},{"time":0.867,"pitch":40.941},{"time":0.875,"pitch":40.953},{"time":0.883,"pitch":40.963},{"time":0.892,"pitch":40.970},{"time":0.900,"pitch":40.977},{"time":0.908,"pitch":40.981},{"time":0.917,"pitch":40.985},{"time":0.925,"pitch":40.988},{"time":0.933,"pitch":40.991},{"time":0.942,"pitch":40.993},{"time":0.950,"pitch":40.994},{"time":0.958,"pitch":40.995},{"time":0.967,"pitch":40.996},{"time":0.975,"pitch":40.997},{"time":0.983,"pitch":40.998},{"time":1.000,"pitch":40.999},{"time":1.042,"pitch":41.000},{"time":1.258,"pitch":40.381},{"time":1.267,"pitch":39.890},{"time":1.275,"pitch":39.500},{"time":1.283,"pitch":39.191},{"time":1.292,"pitch":38.945},{"time":1.300,"pitch":38.750},{"time":1.308,"pitch":38.595},{"time":1.317,"pitch":38.472},{"time":1.325,"pitch":38.375},{"time":1.333,"pitch":38.298},{"time":1.342,"pitch":38.236},{"time":1.350,"pitch":38.187},{"time":1.358,"pitch":38.149},{"time":1.367,"pitch":38.118},{"time":1.375,"pitch":38.094},{"time":1.383,"pitch":38.074},{"time":1.392,"pitch":38.059},{"time":1.400,"pitch":38.047},{"time":1.408,"pitch":38.037},{"time":1.417,"pitch":38.030},{"time":1.425,"pitch":38.023},{"time":1.433,"pitch":38.019},{"time":1.442,"pitch":38.015},{"time":1.450,"pitch":38.012},{"time":1.458,"pitch":38.009},{"time":1.467,"pitch":38.007},{"time":1.475,"pitch":38.006},{"time":1.483,"pitch":38.005},{"time":1.492,"pitch":38.004},{"time":1.500,"pitch":38.622},{"time":1.508,"pitch":39.112},{"time":1.517,"pitch":39.502},{"time":1.525,"pitch":39.811},{"time":1.533,"pitch":40.056},{"time":1.542,"pitch":40.251},{"time":1.550,"pitch":40.405},{"time":1.558,"pitch":40.528},{"time":1.567,"pitch":40.625},{"time":1.575,"pitch":40.703},{"time":1.583,"pitch":40.764},{"time":1.592,"pitch":40.813},{"time":1.600,"pitch":40.851},{"time":1.608,"pitch":40.882},{"time":1.617,"pitch":40.906},{"time":1.625,"pitch":40.926},{"time":1.633,"pitch":40.941},{"time":1.642,"pitch":40.953},{"time":1.650,"pitch":40.963},{"time":1.658,"pitch":40.971},{"time":1.667,"pitch":40.977},{"time":1.675,"pitch":40.981},{"time":1.683,"pitch":40.985},{"time":1.692,"pitch":40.988},{"time":1.700,"pitch":40.991},{"time":1.708,"pitch":40.993},{"time":1.717,"pitch":40.994},{"time":1.725,"pitch":40.995},{"time":1.733,"pitch":40.996},{"time":1.742,"pitch":40.997},{"time":1.750,"pitch":40.998},{"time":1.767,"pitch":40.999},{"time":1.808,"pitch":41.000},{"time":2.008,"pitch":40.381},{"time":2.017,"pitch":39.890},{"time":2.025,"pitch":39.500},{"time":2.033,"pitch":39.191},{"time":2.042,"pitch":38.945},{"time":2.050,"pitch":38.750},{"time":2.058,"pitch":38.595},{"time":2.067,"pitch":38.472},{"time":2.075,"pitch":38.375},{"time":2.083,"pitch":38.298},{"time":2.092,"pitch":38.236},{"time":2.100,"pitch":38.187},{"time":2.108,"pitch":38.149},{"time":2.117,"pitch":38.118},{"time":2.125,"pitch":38.094},{"time":2.133,"pitch":38.074},{"time":2.142,"pitch":38.059},{"time":2.150,"pitch":38.047},{"time":2.158,"pitch":38.037},{"time":2.167,"pitch":38.030},{"time":2.175,"pitch":38.023},{"time":2.183,"pitch":38.019},{"time":2.192,"pitch":38.015},{"time":2.200,"pitch":38.012},{"time":2.208,"pitch":38.009},{"time":2.217,"pitch":38.007},{"time":2.225,"pitch":38.006},{"time":2.233,"pitch":38.005},{"time":2.242,"pitch":38.004},{"time":2.250,"pitch":38.003},{"time":2.258,"pitch":38.002},{"time":2.275,"pitch":38.001},{"time":2.317,"pitch":38.000},{"time":2.758,"pitch":37.587},{"time":2.767,"pitch":37.260},{"time":2.775,"pitch":37.000},{"time":2.783,"pitch":36.794},{"time":2.792,"pitch":36.630},{"time":2.800,"pitch":36.500},{"time":2.808,"pitch":36.397},{"time":2.817,"pitch":36.315},{"time":2.825,"pitch":36.250},{"time":2.833,"pitch":36.198},{"time":2.842,"pitch":36.157},{"time":2.850,"pitch":36.125},{"time":2.858,"pitch":36.099},{"time":2.867,"pitch":36.079},{"time":2.875,"pitch":36.063},{"time":2.883,"pitch":36.050},{"time":2.892,"pitch":36.039},{"time":2.900,"pitch":36.031},{"time":2.908,"pitch":36.025},{"time":2.917,"pitch":36.020},{"time":2.925,"pitch":36.016},{"time":2.933,"pitch":36.012},{"time":2.942,"pitch":36.010},{"time":2.950,"pitch":36.008},{"time":2.958,"pitch":36.006},{"time":2.967,"pitch":36.005},{"time":2.975,"pitch":36.004},{"time":2.983,"pitch":36.003},{"time":2.992,"pitch":36.002},{"time":3.017,"pitch":36.001},{"time":3.050,"pitch":36.000},{"time":3.258,"pitch":35.381},{"time":3.267,"pitch":34.890},{"time":3.275,"pitch":34.500},{"time":3.283,"pitch":34.191},{"time":3.292,"pitch":33.945},{"time":3.300,"pitch":33.750},{"time":3.308,"pitch":33.595},{"time":3.317,"pitch":33.472},{"time":3.325,"pitch":33.375},{"time":3.333,"pitch":33.298},{"time":3.342,"pitch":33.236},{"time":3.350,"pitch":33.188},{"time":3.358,"pitch":33.149},{"time":3.367,"pitch":33.118},{"time":3.375,"pitch":33.094},{"time":3.383,"pitch":33.074},{"time":3.392,"pitch":33.059},{"time":3.400,"pitch":33.047},{"time":3.408,"pitch":33.037},{"time":3.417,"pitch":33.030},{"time":3.425,"pitch":33.023},{"time":3.433,"pitch":33.019},{"time":3.442,"pitch":33.015},{"time":3.450,"pitch":33.012},{"time":3.458,"pitch":33.009},{"time":3.467,"pitch":33.007},{"time":3.475,"pitch":33.006},{"time":3.483,"pitch":33.005},{"time":3.492,"pitch":33.004},{"time":3.500,"pitch":33.003},{"time":3.508,"pitch":33.621},{"time":3.517,"pitch":34.112},{"time":3.525,"pitch":34.501},{"time":3.533,"pitch":34.811},{"time":3.542,"pitch":35.056},{"time":3.550,"pitch":35.251},{"time":3.558,"pitch":35.405},{"time":3.567,"pitch":35.528},{"time":3.575,"pitch":35.625},{"time":3.583,"pitch":35.703},{"time":3.592,"pitch":35.764},{"time":3.600,"pitch":35.813},{"time":3.608,"pitch":35.851},{"time":3.617,"pitch":35.882},{"time":3.625,"pitch":35.906},{"time":3.633,"pitch":35.926},{"time":3.642,"pitch":35.941},{"time":3.650,"pitch":35.953},{"time":3.658,"pitch":35.963},{"time":3.667,"pitch":35.970},{"time":3.675,"pitch":35.977},{"time":3.683,"pitch":35.981},{"time":3.692,"pitch":35.985},{"time":3.700,"pitch":35.988},{"time":3.708,"pitch":35.991},{"time":3.717,"pitch":35.993},{"time":3.725,"pitch":35.994},{"time":3.733,"pitch":35.995},{"time":3.742,"pitch":35.996},{"time":3.750,"pitch":35.997},{"time":3.758,"pitch":35.998},{"time":3.775,"pitch":35.999},{"time":3.817,"pitch":36.000},{"time":4.000,"pitch":36.413},{"time":4.008,"pitch":36.740},{"time":4.017,"pitch":37.000},{"time":4.025,"pitch":37.206},{"time":4.033,"pitch":37.370},{"time":4.042,"pitch":37.500},{"time":4.050,"pitch":37.603},{"time":4.058,"pitch":37.685},{"time":4.067,"pitch":37.750},{"time":4.075,"pitch":37.802},{"time":4.083,"pitch":37.843},{"time":4.092,"pitch":37.875},{"time":4.100,"pitch":37.901},{"time":4.108,"pitch":37.921},{"time":4.117,"pitch":37.937},{"time":4.125,"pitch":37.950},{"time":4.133,"pitch":37.961},{"time":4.142,"pitch":37.969},{"time":4.150,"pitch":37.975},{"time":4.158,"pitch":37.980},{"time":4.167,"pitch":37.984},{"time":4.175,"pitch":37.988},{"time":4.183,"pitch":37.990},{"time":4.192,"pitch":37.992},{"time":4.200,"pitch":37.994},{"time":4.208,"pitch":37.995},{"time":4.217,"pitch":37.996},{"time":4.225,"pitch":37.997},{"time":4.233,"pitch":37.998},{"time":4.258,"pitch":37.999},{"time":4.292,"pitch":38.000},{"time":4.733,"pitch":38.619},{"time":4.742,"pitch":39.110},{"time":4.750,"pitch":39.500},{"time":4.758,"pitch":39.809},{"time":4.767,"pitch":40.055},{"time":4.775,"pitch":40.250},{"time":4.783,"pitch":40.405},{"time":4.792,"pitch":40.528},{"time":4.800,"pitch":40.625},{"time":4.808,"pitch":40.702},{"time":4.817,"pitch":40.764},{"time":4.825,"pitch":40.812},{"time":4.833,"pitch":40.851},{"time":4.842,"pitch":40.882},{"time":4.850,"pitch":40.906},{"time":4.858,"pitch":40.926},{"time":4.867,"pitch":40.941},{"time":4.875,"pitch":40.953},{"time":4.883,"pitch":40.963},{"time":4.892,"pitch":40.970},{"time":4.900,"pitch":40.977},{"time":4.908,"pitch":40.981},{"time":4.917,"pitch":40.985},{"time":4.925,"pitch":40.988},{"time":4.933,"pitch":40.991},{"time":4.942,"pitch":40.993},{"time":4.950,"pitch":40.994},{"time":4.958,"pitch":40.995},{"time":4.967,"pitch":40.996},{"time":4.975,"pitch":40.997},{"time":4.983,"pitch":40.998},{"time":5.000,"pitch":40.999},{"time":5.042,"pitch":41.000},{"time":5.258,"pitch":40.381},{"time":5.267,"pitch":39.890},{"time":5.275,"pitch":39.500},{"time":5.283,"pitch":39.191},{"time":5.292,"pitch":38.945},{"time":5.300,"pitch":38.750},{"time":5.308,"pitch":38.595},{"time":5.317,"pitch":38.472},{"time":5.325,"pitch":38.375},{"time":5.333,"pitch":38.298},{"time":5.342,"pitch":38.236},{"time":5.350,"pitch":38.187},{"time":5.358,"pitch":38.149},{"time":5.367,"pitch":38.118},{"time":5.375,"pitch":38.094},{"time":5.383,"pitch":38.074},{"time":5.392,"pitch":38.059},{"time":5.400,"pitch":38.047},{"time":5.408,"pitch":38.037},{"time":5.417,"pitch":38.030},{"time":5.425,"pitch":38.023},{"time":5.433,"pitch":38.019},{"time":5.442,"pitch":38.015},{"time":5.450,"pitch":38.012},{"time":5.458,"pitch":38.009},{"time":5.467,"pitch":38.007},{"time":5.475,"pitch":38.006},{"time":5.483,"pitch":38.005},{"time":5.492,"pitch":38.004},{"time":5.500,"pitch":38.622},{"time":5.508,"pitch":39.112},{"time":5.517,"pitch":39.502},{"time":5.525,"pitch":39.811},{"time":5.533,"pitch":40.056},{"time":5.542,"pitch":40.251},{"time":5.550,"pitch":40.405},{"time":5.558,"pitch":40.528},{"time":5.567,"pitch":40.625},{"time":5.575,"pitch":40.703},{"time":5.583,"pitch":40.764},{"time":5.592,"pitch":40.813},{"time":5.600,"pitch":40.851},{"time":5.608,"pitch":40.882},{"time":5.617,"pitch":40.906},{"time":5.625,"pitch":40.926},{"time":5.633,"pitch":40.941},{"time":5.642,"pitch":40.953},{"time":5.650,"pitch":40.963},{"time":5.658,"pitch":40.971},{"time":5.667,"pitch":40.977},{"time":5.675,"pitch":40.981},{"time":5.683,"pitch":40.985},{"time":5.692,"pitch":40.988},{"time":5.700,"pitch":40.991},{"time":5.708,"pitch":40.993},{"time":5.717,"pitch":40.994},{"time":5.725,"pitch":40.995},{"time":5.733,"pitch":40.996},{"time":5.742,"pitch":40.997},{"time":5.750,"pitch":40.998},{"time":5.767,"pitch":40.999},{"time":5.808,"pitch":41.000},{"time":6.008,"pitch":40.381},{"time":6.017,"pitch":39.890},{"time":6.025,"pitch":39.500},{"time":6.033,"pitch":39.191},{"time":6.042,"pitch":38.945},{"time":6.050,"pitch":38.750},{"time":6.058,"pitch":38.595},{"time":6.067,"pitch":38.472},{"time":6.075,"pitch":38.375},{"time":6.083,"pitch":38.298},{"time":6.092,"pitch":38.236},{"time":6.100,"pitch":38.187},{"time":6.108,"pitch":38.149},{"time":6.117,"pitch":38.118},{"time":6.125,"pitch":38.094},{"time":6.133,"pitch":38.074},{"time":6.142,"pitch":38.059},{"time":6.150,"pitch":38.047},{"time":6.158,"pitch":38.037},{"time":6.167,"pitch":38.030},{"time":6.175,"pitch":38.023},{"time":6.183,"pitch":38.019},{"time":6.192,"pitch":38.015},{"time":6.200,"pitch":38.012},{"time":6.208,"pitch":38.009},{"time":6.217,"pitch":38.007},{"time":6.225,"pitch":38.006},{"time":6.233,"pitch":38.005},{"time":6.242,"pitch":38.004},{"time":6.250,"pitch":38.003},{"time":6.258,"pitch":38.002},{"time":6.275,"pitch":38.001},{"time":6.317,"pitch":38.000},{"time":6.758,"pitch":37.587},{"time":6.767,"pitch":37.260},{"time":6.775,"pitch":37.000},{"time":6.783,"pitch":36.794},{"time":6.792,"pitch":36.630},{"time":6.800,"pitch":36.500},{"time":6.808,"pitch":36.397},{"time":6.817,"pitch":36.315},{"time":6.825,"pitch":36.250},{"time":6.833,"pitch":36.198},{"time":6.842,"pitch":36.157},{"time":6.850,"pitch":36.125},{"time":6.858,"pitch":36.099},{"time":6.867,"pitch":36.079},{"time":6.875,"pitch":36.063},{"time":6.883,"pitch":36.050},{"time":6.892,"pitch":36.039},{"time":6.900,"pitch":36.031},{"time":6.908,"pitch":36.025},{"time":6.917,"pitch":36.020},{"time":6.925,"pitch":36.016},{"time":6.933,"pitch":36.012},{"time":6.942,"pitch":36.010},{"time":6.950,"pitch":36.008},{"time":6.958,"pitch":36.006},{"time":6.967,"pitch":36.005},{"time":6.975,"pitch":36.004},{"time":6.983,"pitch":36.003},{"time":6.992,"pitch":36.002},{"time":7.017,"pitch":36.001},{"time":7.050,"pitch":36.000},{"time":7.258,"pitch":35.381},{"time":7.267,"pitch":34.890},{"time":7.275,"pitch":34.500},{"time":7.283,"pitch":34.191},{"time":7.292,"pitch":33.945},{"time":7.300,"pitch":33.750},{"time":7.308,"pitch":33.595},{"time":7.317,"pitch":33.472},{"time":7.325,"pitch":33.375},{"time":7.333,"pitch":33.298},{"time":7.342,"pitch":33.236},{"time":7.350,"pitch":33.188},{"time":7.358,"pitch":33.149},{"time":7.367,"pitch":33.118},{"time":7.375,"pitch":33.094},{"time":7.383,"pitch":33.074},{"time":7.392,"pitch":33.059},{"time":7.400,"pitch":33.047},{"time":7.408,"pitch":33.037},{"time":7.417,"pitch":33.030},{"time":7.425,"pitch":33.023},{"time":7.433,"pitch":33.019},{"time":7.442,"pitch":33.015},{"time":7.450,"pitch":33.012},{"time":7.458,"pitch":33.009},{"time":7.467,"pitch":33.007},{"time":7.475,"pitch":33.006},{"time":7.483,"pitch":33.005},{"time":7.492,"pitch":33.004},{"time":7.500,"pitch":33.003},{"time":7.508,"pitch":33.621},{"time":7.517,"pitch":34.112},{"time":7.525,"pitch":34.501},{"time":7.533,"pitch":34.811},{"time":7.542,"pitch":35.056},{"time":7.550,"pitch":35.251},{"time":7.558,"pitch":35.405},{"time":7.567,"pitch":35.528},{"time":7.575,"pitch":35.625},{"time":7.583,"pitch":35.703},{"time":7.592,"pitch":35.764},{"time":7.600,"pitch":35.813},{"time":7.608,"pitch":35.851},{"time":7.617,"pitch":35.882},{"time":7.625,"pitch":35.906},{"time":7.633,"pitch":35.926},{"time":7.642,"pitch":35.941},{"time":7.650,"pitch":35.953},{"time":7.658,"pitch":35.963},{"time":7.667,"pitch":35.970},{"time":7.675,"pitch":35.977},{"time":7.683,"pitch":35.981},{"time":7.692,"pitch":35.985},{"time":7.700,"pitch":35.988},{"time":7.708,"pitch":35.991},{"time":7.717,"pitch":35.993},{"time":7.725,"pitch":35.994},{"time":7.733,"pitch":35.995},{"time":7.742,"pitch":35.996},{"time":7.750,"pitch":35.997},{"time":7.758,"pitch":35.998},{"time":7.775,"pitch":35.999},{"time":7.817,"pitch":36.000},{"time":8.000,"pitch":36.413},{"time":8.008,"pitch":36.740},{"time":8.017,"pitch":37.000},{"time":8.025,"pitch":37.206},{"time":8.033,"pitch":37.370},{"time":8.042,"pitch":37.500},{"time":8.050,"pitch":37.603},{"time":8.058,"pitch":37.685},{"time":8.067,"pitch":37.750},{"time":8.075,"pitch":37.802},{"time":8.083,"pitch":37.843},{"time":8.092,"pitch":37.875},{"time":8.100,"pitch":37.901},{"time":8.108,"pitch":37.921},{"time":8.117,"pitch":37.937},{"time":8.125,"pitch":37.950},{"time":8.133,"pitch":37.961},{"time":8.142,"pitch":37.969},{"time":8.150,"pitch":37.975},{"time":8.158,"pitch":37.980},{"time":8.167,"pitch":37.984},{"time":8.175,"pitch":37.988},{"time":8.183,"pitch":37.990},{"time":8.192,"pitch":37.992},{"time":8.200,"pitch":37.994},{"time":8.208,"pitch":37.995},{"time":8.217,"pitch":37.996},{"time":8.225,"pitch":37.997},{"time":8.233,"pitch":37.998},{"time":8.258,"pitch":37.999},{"time":8.292,"pitch":38.000},{"time":8.733,"pitch":38.619},{"time":8.742,"pitch":39.110},{"time":8.750,"pitch":39.500},{"time":8.758,"pitch":39.809},{"time":8.767,"pitch":40.055},{"time":8.775,"pitch":40.250},{"time":8.783,"pitch":40.405},{"time":8.792,"pitch":40.528},{"time":8.800,"pitch":40.625},{"time":8.808,"pitch":40.702},{"time":8.817,"pitch":40.764},{"time":8.825,"pitch":40.812},{"time":8.833,"pitch":40.851},{"time":8.842,"pitch":40.882},{"time":8.850,"pitch":40.906},{"time":8.858,"pitch":40.926},{"time":8.867,"pitch":40.941},{"time":8.875,"pitch":40.953},{"time":8.883,"pitch":40.963},{"time":8.892,"pitch":40.970},{"time":8.900,"pitch":40.977},{"time":8.908,"pitch":40.981},{"time":8.917,"pitch":40.985},{"time":8.925,"pitch":40.988},{"time":8.933,"pitch":40.991},{"time":8.942,"pitch":40.993},{"time":8.950,"pitch":40.994},{"time":8.958,"pitch":40.995},{"time":8.967,"pitch":40.996},{"time":8.975,"pitch":40.997},{"time":8.983,"pitch":40.998},{"time":9.000,"pitch":40.999},{"time":9.042,"pitch":41.000},{"time":9.258,"pitch":40.381},{"time":9.267,"pitch":39.890},{"time":9.275,"pitch":39.500},{"time":9.283,"pitch":39.191},{"time":9.292,"pitch":38.945},{"time":9.300,"pitch":38.750},{"time":9.308,"pitch":38.595},{"time":9.317,"pitch":38.472},{"time":9.325,"pitch":38.375},{"time":9.333,"pitch":38.298},{"time":9.342,"pitch":38.236},{"time":9.350,"pitch":38.187},{"time":9.358,"pitch":38.149},{"time":9.367,"pitch":38.118},{"time":9.375,"pitch":38.094},{"time":9.383,"pitch":38.074},{"time":9.392,"pitch":38.059},{"time":9.400,"pitch":38.047},{"time":9.408,"pitch":38.037},{"time":9.417,"pitch":38.030},{"time":9.425,"pitch":38.023},{"time":9.433,"pitch":38.019},{"time":9.442,"pitch":38.015},{"time":9.450,"pitch":38.012},{"time":9.458,"pitch":38.009},{"time":9.467,"pitch":38.007},{"time":9.475,"pitch":38.006},{"time":9.483,"pitch":38.005},{"time":9.492,"pitch":38.004},{"time":9.500,"pitch":38.622},{"time":9.508,"pitch":39.112},{"time":9.517,"pitch":39.502},{"time":9.525,"pitch":39.811},{"time":9.533,"pitch":40.056},{"time":9.542,"pitch":40.251},{"time":9.550,"pitch":40.405},{"time":9.558,"pitch":40.528},{"time":9.567,"pitch":40.625},{"time":9.575,"pitch":40.703},{"time":9.583,"pitch":40.764},{"time":9.592,"pitch":40.813},{"time":9.600,"pitch":40.851},{"time":9.608,"pitch":40.882},{"time":9.617,"pitch":40.906},{"time":9.625,"pitch":40.926},{"time":9.633,"pitch":40.941},{"time":9.642,"pitch":40.953},{"time":9.650,"pitch":40.963},{"time":9.658,"pitch":40.971},{"time":9.667,"pitch":40.977},{"time":9.675,"pitch":40.981},{"time":9.683,"pitch":40.985},{"time":9.692,"pitch":40.988},{"time":9.700,"pitch":40.991},{"time":9.708,"pitch":40.993},{"time":9.717,"pitch":40.994},{"time":9.725,"pitch":40.995},{"time":9.733,"pitch":40.996},{"time":9.742,"pitch":40.997},{"time":9.750,"pitch":40.998},{"time":9.767,"pitch":40.999},{"time":9.808,"pitch":41.000},{"time":10.008,"pitch":40.381},{"time":10.017,"pitch":39.890},{"time":10.025,"pitch":39.500},{"time":10.033,"pitch":39.191},{"time":10.042,"pitch":38.945},{"time":10.050,"pitch":38.750},{"time":10.058,"pitch":38.595},{"time":10.067,"pitch":38.472},{"time":10.075,"pitch":38.375},{"time":10.083,"pitch":38.298},{"time":10.092,"pitch":38.236},{"time":10.100,"pitch":38.187},{"time":10.108,"pitch":38.149},{"time":10.117,"pitch":38.118},{"time":10.125,"pitch":38.094},{"time":10.133,"pitch":38.074},{"time":10.142,"pitch":38.059},{"time":10.150,"pitch":38.047},{"time":10.158,"pitch":38.037},{"time":10.167,"pitch":38.030},{"time":10.175,"pitch":38.023},{"time":10.183,"pitch":38.019},{"time":10.192,"pitch":38.015},{"time":10.200,"pitch":38.012},{"time":10.208,"pitch":38.009},{"time":10.217,"pitch":38.007},{"time":10.225,"pitch":38.006},{"time":10.233,"pitch":38.005},{"time":10.242,"pitch":38.004},{"time":10.250,"pitch":38.003},{"time":10.258,"pitch":38.002},{"time":10.275,"pitch":38.001},{"time":10.317,"pitch":38.000},{"time":10.758,"pitch":37.587},{"time":10.767,"pitch":37.260},{"time":10.775,"pitch":37.000},{"time":10.783,"pitch":36.794},{"time":10.792,"pitch":36.630},{"time":10.800,"pitch":36.500},{"time":10.808,"pitch":36.397},{"time":10.817,"pitch":36.315},{"time":10.825,"pitch":36.250},{"time":10.833,"pitch":36.198},{"time":10.842,"pitch":36.157},{"time":10.850,"pitch":36.125},{"time":10.858,"pitch":36.099},{"time":10.867,"pitch":36.079},{"time":10.875,"pitch":36.063},{"time":10.883,"pitch":36.050},{"time":10.892,"pitch":36.039},{"time":10.900,"pitch":36.031},{"time":10.908,"pitch":36.025},{"time":10.917,"pitch":36.020},{"time":10.925,"pitch":36.016},{"time":10.933,"pitch":36.012},{"time":10.942,"pitch":36.010},{"time":10.950,"pitch":36.008},{"time":10.958,"pitch":36.006},{"time":10.967,"pitch":36.005},{"time":10.975,"pitch":36.004},{"time":10.983,"pitch":36.003},{"time":10.992,"pitch":36.002},{"time":11.017,"pitch":36.001},{"time":11.050,"pitch":36.000},{"time":11.258,"pitch":35.381},{"time":11.267,"pitch":34.890},{"time":11.275,"pitch":34.500},{"time":11.283,"pitch":34.191},{"time":11.292,"pitch":33.945},{"time":11.300,"pitch":33.750},{"time":11.308,"pitch":33.595},{"time":11.317,"pitch":33.472},{"time":11.325,"pitch":33.375},{"time":11.333,"pitch":33.298},{"time":11.342,"pitch":33.236},{"time":11.350,"pitch":33.188},{"time":11.358,"pitch":33.149},{"time":11.367,"pitch":33.118},{"time":11.375,"pitch":33.094},{"time":11.383,"pitch":33.074},{"time":11.392,"pitch":33.059},{"time":11.400,"pitch":33.047},{"time":11.408,"pitch":33.037},{"time":11.417,"pitch":33.030},{"time":11.425,"pitch":33.023},{"time":11.433,"pitch":33.019},{"time":11.442,"pitch":33.015},{"time":11.450,"pitch":33.012},{"time":11.458,"pitch":33.009},{"time":11.467,"pitch":33.007},{"time":11.475,"pitch":33.006},{"time":11.483,"pitch":33.005},{"time":11.492,"pitch":33.004},{"time":11.500,"pitch":33.003},{"time":11.508,"pitch":33.621},{"time":11.517,"pitch":34.112},{"time":11.525,"pitch":34.501},{"time":11.533,"pitch":34.811},{"time":11.542,"pitch":35.056},{"time":11.550,"pitch":35.251},{"time":11.558,"pitch":35.405},{"time":11.567,"pitch":35.528},{"time":11.575,"pitch":35.625},{"time":11.583,"pitch":35.703},{"time":11.592,"pitch":35.764},{"time":11.600,"pitch":35.813},{"time":11.608,"pitch":35.851},{"time":11.617,"pitch":35.882},{"time":11.625,"pitch":35.906},{"time":11.633,"pitch":35.926},{"time":11.642,"pitch":35.941},{"time":11.650,"pitch":35.953},{"time":11.658,"pitch":35.963},{"time":11.667,"pitch":35.970},{"time":11.675,"pitch":35.977},{"time":11.683,"pitch":35.981},{"time":11.692,"pitch":35.985},{"time":11.700,"pitch":35.988},{"time":11.708,"pitch":35.991},{"time":11.717,"pitch":35.993},{"time":11.725,"pitch":35.994},{"time":11.733,"pitch":35.995},{"time":11.742,"pitch":35.996},{"time":11.750,"pitch":35.997},{"time":11.758,"pitch":35.998},{"time":11.775,"pitch":35.999},{"time":11.817,"pitch":36.000},{"time":12.000,"pitch":36.413},{"time":12.008,"pitch":36.740},{"time":12.017,"pitch":37.000},{"time":12.025,"pitch":37.206},{"time":12.033,"pitch":37.370},{"time":12.042,"pitch":37.500},{"time":12.050,"pitch":37.603},{"time":12.058,"pitch":37.685},{"time":12.067,"pitch":37.750},{"time":12.075,"pitch":37.802},{"time":12.083,"pitch":37.843},{"time":12.092,"pitch":37.875},{"time":12.100,"pitch":37.901},{"time":12.108,"pitch":37.921},{"time":12.117,"pitch":37.937},{"time":12.125,"pitch":37.950},{"time":12.133,"pitch":37.961},{"time":12.142,"pitch":37.969},{"time":12.150,"pitch":37.975},{"time":12.158,"pitch":37.980},{"time":12.167,"pitch":37.984},{"time":12.175,"pitch":37.988},{"time":12.183,"pitch":37.990},{"time":12.192,"pitch":37.992},{"time":12.200,"pitch":37.994},{"time":12.208,"pitch":37.995},{"time":12.217,"pitch":37.996},{"time":12.225,"pitch":37.997},{"time":12.233,"pitch":37.998},{"time":12.258,"pitch":37.999},{"time":12.292,"pitch":38.000},{"time":12.733,"pitch":38.619},{"time":12.742,"pitch":39.110},{"time":12.750,"pitch":39.500},{"time":12.758,"pitch":39.809},{"time":12.767,"pitch":40.055},{"time":12.775,"pitch":40.250},{"time":12.783,"pitch":40.405},{"time":12.792,"pitch":40.528},{"time":12.800,"pitch":40.625},{"time":12.808,"pitch":40.702},{"time":12.817,"pitch":40.764},{"time":12.825,"pitch":40.812},{"time":12.833,"pitch":40.851},{"time":12.842,"pitch":40.882},{"time":12.850,"pitch":40.906},{"time":12.858,"pitch":40.926},{"time":12.867,"pitch":40.941},{"time":12.875,"pitch":40.953},{"time":12.883,"pitch":40.963},{"time":12.892,"pitch":40.970},{"time":12.900,"pitch":40.977},{"time":12.908,"pitch":40.981},{"time":12.917,"pitch":40.985},{"time":12.925,"pitch":40.988},{"time":12.933,"pitch":40.991},{"time":12.942,"pitch":40.993},{"time":12.950,"pitch":40.994},{"time":12.958,"pitch":40.995},{"time":12.967,"pitch":40.996},{"time":12.975,"pitch":40.997},{"time":12.983,"pitch":40.998},{"time":13.000,"pitch":40.999},{"time":13.042,"pitch":41.000},{"time":13.225,"pitch":41.619},{"time":13.233,"pitch":42.110},{"time":13.242,"pitch":42.500},{"time":13.250,"pitch":42.809},{"time":13.258,"pitch":43.055},{"time":13.267,"pitch":43.250},{"time":13.275,"pitch":43.405},{"time":13.283,"pitch":43.528},{"time":13.292,"pitch":43.625},{"time":13.300,"pitch":43.702},{"time":13.308,"pitch":43.764},{"time":13.317,"pitch":43.812},{"time":13.325,"pitch":43.851},{"time":13.333,"pitch":43.882},{"time":13.342,"pitch":43.906},{"time":13.350,"pitch":43.926},{"time":13.358,"pitch":43.941},{"time":13.367,"pitch":43.953},{"time":13.375,"pitch":43.963},{"time":13.383,"pitch":43.970},{"time":13.392,"pitch":43.977},{"time":13.400,"pitch":43.981},{"time":13.408,"pitch":43.985},{"time":13.417,"pitch":43.988},{"time":13.425,"pitch":43.991},{"time":13.433,"pitch":43.993},{"time":13.442,"pitch":43.994},{"time":13.450,"pitch":43.995},{"time":13.458,"pitch":43.996},{"time":13.467,"pitch":43.997},{"time":13.475,"pitch":43.998},{"time":13.492,"pitch":43.999},{"time":13.525,"pitch":43.793},{"time":13.533,"pitch":43.629},{"time":13.542,"pitch":43.500},{"time":13.550,"pitch":43.397},{"time":13.558,"pitch":43.315},{"time":13.567,"pitch":43.250},{"time":13.575,"pitch":43.198},{"time":13.583,"pitch":43.157},{"time":13.592,"pitch":43.125},{"time":13.600,"pitch":43.099},{"time":13.608,"pitch":43.079},{"time":13.617,"pitch":43.062},{"time":13.625,"pitch":43.050},{"time":13.633,"pitch":43.039},{"time":13.642,"pitch":43.031},{"time":13.650,"pitch":43.025},{"time":13.658,"pitch":43.020},{"time":13.667,"pitch":43.016},{"time":13.675,"pitch":43.012},{"time":13.683,"pitch":43.010},{"time":13.692,"pitch":43.008},{"time":13.700,"pitch":43.006},{"time":13.708,"pitch":43.005},{"time":13.717,"pitch":43.004},{"time":13.725,"pitch":43.003},{"time":13.733,"pitch":43.002},{"time":13.758,"pitch":43.001},{"time":13.792,"pitch":43.000},{"time":14.000,"pitch":42.587},{"time":14.008,"pitch":42.260},{"time":14.017,"pitch":42.000},{"time":14.025,"pitch":41.794},{"time":14.033,"pitch":41.630},{"time":14.042,"pitch":41.500},{"time":14.050,"pitch":41.397},{"time":14.058,"pitch":41.315},{"time":14.067,"pitch":41.250},{"time":14.075,"pitch":41.198},{"time":14.083,"pitch":41.157},{"time":14.092,"pitch":41.125},{"time":14.100,"pitch":41.099},{"time":14.108,"pitch":41.079},{"time":14.117,"pitch":41.063},{"time":14.125,"pitch":41.050},{"time":14.133,"pitch":41.039},{"time":14.142,"pitch":41.031},{"time":14.150,"pitch":41.025},{"time":14.158,"pitch":41.020},{"time":14.167,"pitch":41.016},{"time":14.175,"pitch":41.012},{"time":14.183,"pitch":41.010},{"time":14.192,"pitch":41.008},{"time":14.200,"pitch":41.006},{"time":14.208,"pitch":41.005},{"time":14.217,"pitch":41.004},{"time":14.225,"pitch":41.003},{"time":14.233,"pitch":41.002},{"time":14.258,"pitch":41.001},{"time":14.292,"pitch":41.000},{"time":14.758,"pitch":40.381},{"time":14.767,"pitch":39.890},{"time":14.775,"pitch":39.500},{"time":14.783,"pitch":39.191},{"time":14.792,"pitch":38.945},{"time":14.800,"pitch":38.750},{"time":14.808,"pitch":38.595},{"time":14.817,"pitch":38.472},{"time":14.825,"pitch":38.375},{"time":14.833,"pitch":38.298},{"time":14.842,"pitch":38.236},{"time":14.850,"pitch":38.188},{"time":14.858,"pitch":38.149},{"time":14.867,"pitch":38.118},{"time":14.875,"pitch":38.094},{"time":14.883,"pitch":38.074},{"time":14.892,"pitch":38.059},{"time":14.900,"pitch":38.047},{"time":14.908,"pitch":38.037},{"time":14.917,"pitch":38.030},{"time":14.925,"pitch":38.023},{"time":14.933,"pitch":38.019},{"time":14.942,"pitch":38.015},{"time":14.950,"pitch":38.012},{"time":14.958,"pitch":38.009},{"time":14.967,"pitch":38.007},{"time":14.975,"pitch":38.006},{"time":14.983,"pitch":38.005},{"time":14.992,"pitch":38.004},{"time":15.000,"pitch":38.003},{"time":15.008,"pitch":38.002},{"time":15.025,"pitch":38.001},{"time":15.067,"pitch":38.000},{"time":15.208,"pitch":36.969},{"time":15.217,"pitch":36.150},{"time":15.225,"pitch":35.500},{"time":15.233,"pitch":34.984},{"time":15.242,"pitch":34.575},{"time":15.250,"pitch":34.250},{"time":15.258,"pitch":33.992},{"time":15.267,"pitch":33.787},{"time":15.275,"pitch":33.625},{"time":15.283,"pitch":33.496},{"time":15.292,"pitch":33.394},{"time":15.300,"pitch":33.313},{"time":15.308,"pitch":33.248},{"time":15.317,"pitch":33.197},{"time":15.325,"pitch":33.156},{"time":15.333,"pitch":33.124},{"time":15.342,"pitch":33.098},{"time":15.350,"pitch":33.078},{"time":15.358,"pitch":33.062},{"time":15.367,"pitch":33.049},{"time":15.375,"pitch":33.039},{"time":15.383,"pitch":33.031},{"time":15.392,"pitch":33.025},{"time":15.400,"pitch":33.020},{"time":15.408,"pitch":33.016},{"time":15.417,"pitch":33.012},{"time":15.425,"pitch":33.010},{"time":15.433,"pitch":33.008},{"time":15.442,"pitch":33.006},{"time":15.450,"pitch":33.005},{"time":15.458,"pitch":33.004},{"time":15.467,"pitch":33.003},{"time":15.475,"pitch":33.002},{"time":15.500,"pitch":33.001},{"time":15.508,"pitch":33.620},{"time":15.517,"pitch":34.111},{"time":15.525,"pitch":34.501},{"time":15.533,"pitch":34.810},{"time":15.542,"pitch":35.055},{"time":15.550,"pitch":35.250},{"time":15.558,"pitch":35.405},{"time":15.567,"pitch":35.528},{"time":15.575,"pitch":35.625},{"time":15.583,"pitch":35.702},{"time":15.592,"pitch":35.764},{"time":15.600,"pitch":35.813},{"time":15.608,"pitch":35.851},{"time":15.617,"pitch":35.882},{"time":15.625,"pitch":35.906},{"time":15.633,"pitch":35.926},{"time":15.642,"pitch":35.941},{"time":15.650,"pitch":35.953},{"time":15.658,"pitch":35.963},{"time":15.667,"pitch":35.970},{"time":15.675,"pitch":35.977},{"time":15.683,"pitch":35.981},{"time":15.692,"pitch":35.985},{"time":15.700,"pitch":35.988},{"time":15.708,"pitch":35.991},{"time":15.717,"pitch":35.993},{"time":15.725,"pitch":35.994},{"time":15.733,"pitch":35.995},{"time":15.742,"pitch":35.996},{"time":15.750,"pitch":35.997},{"time":15.758,"pitch":35.998},{"time":15.775,"pitch":35.999},{"time":15.817,"pitch":36.000},{"time":16.000,"pitch":36.413},{"time":16.008,"pitch":36.740},{"time":16.017,"pitch":37.000},{"time":16.025,"pitch":37.206},{"time":16.033,"pitch":37.370},{"time":16.042,"pitch":37.500},{"time":16.050,"pitch":37.603},{"time":16.058,"pitch":37.685},{"time":16.067,"pitch":37.750},{"time":16.075,"pitch":37.802},{"time":16.083,"pitch":37.843},{"time":16.092,"pitch":37.875},{"time":16.100,"pitch":37.901},{"time":16.108,"pitch":37.921},{"time":16.117,"pitch":37.937},{"time":16.125,"pitch":37.950},{"time":16.133,"pitch":37.961},{"time":16.142,"pitch":37.969},{"time":16.150,"pitch":37.975},{"time":16.158,"pitch":37.980},{"time":16.167,"pitch":37.984},{"time":16.175,"pitch":37.988},{"time":16.183,"pitch":37.990},{"time":16.192,"pitch":37.992},{"time":16.200,"pitch":37.994},{"time":16.208,"pitch":37.995},{"time":16.217,"pitch":37.996},{"time":16.225,"pitch":37.997},{"time":16.233,"pitch":37.998},{"time":16.258,"pitch":37.999},{"time":16.292,"pitch":38.000},{"time":16.733,"pitch":38.619},{"time":16.742,"pitch":39.110},{"time":16.750,"pitch":39.500},{"time":16.758,"pitch":39.809},{"time":16.767,"pitch":40.055},{"time":16.775,"pitch":40.250},{"time":16.783,"pitch":40.405},{"time":16.792,"pitch":40.528},{"time":16.800,"pitch":40.625},{"time":16.808,"pitch":40.702},{"time":16.817,"pitch":40.764},{"time":16.825,"pitch":40.812},{"time":16.833,"pitch":40.851},{"time":16.842,"pitch":40.882},{"time":16.850,"pitch":40.906},{"time":16.858,"pitch":40.926},{"time":16.867,"pitch":40.941},{"time":16.875,"pitch":40.953},{"time":16.883,"pitch":40.963},{"time":16.892,"pitch":40.970},{"time":16.900,"pitch":40.977},{"time":16.908,"pitch":40.981},{"time":16.917,"pitch":40.985},{"time":16.925,"pitch":40.988},{"time":16.933,"pitch":40.991},{"time":16.942,"pitch":40.993},{"time":16.950,"pitch":40.994},{"time":16.958,"pitch":40.995},{"time":16.967,"pitch":40.996},{"time":16.975,"pitch":40.997},{"time":16.983,"pitch":40.998},{"time":17.000,"pitch":40.999},{"time":17.042,"pitch":41.000},{"time":17.258,"pitch":40.381},{"time":17.267,"pitch":39.890},{"time":17.275,"pitch":39.500},{"time":17.283,"pitch":39.191},{"time":17.292,"pitch":38.945},{"time":17.300,"pitch":38.750},{"time":17.308,"pitch":38.595},{"time":17.317,"pitch":38.472},{"time":17.325,"pitch":38.375},{"time":17.333,"pitch":38.298},{"time":17.342,"pitch":38.236},{"time":17.350,"pitch":38.187},{"time":17.358,"pitch":38.149},{"time":17.367,"pitch":38.118},{"time":17.375,"pitch":38.094},{"time":17.383,"pitch":38.074},{"time":17.392,"pitch":38.059},{"time":17.400,"pitch":38.047},{"time":17.408,"pitch":38.037},{"time":17.417,"pitch":38.030},{"time":17.425,"pitch":38.023},{"time":17.433,"pitch":38.019},{"time":17.442,"pitch":38.015},{"time":17.450,"pitch":38.012},{"time":17.458,"pitch":38.009},{"time":17.467,"pitch":38.007},{"time":17.475,"pitch":38.006},{"time":17.483,"pitch":38.005},{"time":17.492,"pitch":38.004},{"time":17.500,"pitch":38.622},{"time":17.508,"pitch":39.112},{"time":17.517,"pitch":39.502},{"time":17.525,"pitch":39.811},{"time":17.533,"pitch":40.056},{"time":17.542,"pitch":40.251},{"time":17.550,"pitch":40.405},{"time":17.558,"pitch":40.528},{"time":17.567,"pitch":40.625},{"time":17.575,"pitch":40.703},{"time":17.583,"pitch":40.764},{"time":17.592,"pitch":40.813},{"time":17.600,"pitch":40.851},{"time":17.608,"pitch":40.882},{"time":17.617,"pitch":40.906},{"time":17.625,"pitch":40.926},{"time":17.633,"pitch":40.941},{"time":17.642,"pitch":40.953},{"time":17.650,"pitch":40.963},{"time":17.658,"pitch":40.971},{"time":17.667,"pitch":40.977},{"time":17.675,"pitch":40.981},{"time":17.683,"pitch":40.985},{"time":17.692,"pitch":40.988},{"time":17.700,"pitch":40.991},{"time":17.708,"pitch":40.993},{"time":17.717,"pitch":40.994},{"time":17.725,"pitch":40.995},{"time":17.733,"pitch":40.996},{"time":17.742,"pitch":40.997},{"time":17.750,"pitch":40.998},{"time":17.767,"pitch":40.999},{"time":17.808,"pitch":41.000},{"time":18.008,"pitch":40.381},{"time":18.017,"pitch":39.890},{"time":18.025,"pitch":39.500},{"time":18.033,"pitch":39.191},{"time":18.042,"pitch":38.945},{"time":18.050,"pitch":38.750},{"time":18.058,"pitch":38.595},{"time":18.067,"pitch":38.472},{"time":18.075,"pitch":38.375},{"time":18.083,"pitch":38.298},{"time":18.092,"pitch":38.236},{"time":18.100,"pitch":38.187},{"time":18.108,"pitch":38.149},{"time":18.117,"pitch":38.118},{"time":18.125,"pitch":38.094},{"time":18.133,"pitch":38.074},{"time":18.142,"pitch":38.059},{"time":18.150,"pitch":38.047},{"time":18.158,"pitch":38.037},{"time":18.167,"pitch":38.030},{"time":18.175,"pitch":38.023},{"time":18.183,"pitch":38.019},{"time":18.192,"pitch":38.015},{"time":18.200,"pitch":38.012},{"time":18.208,"pitch":38.009},{"time":18.217,"pitch":38.007},{"time":18.225,"pitch":38.006},{"time":18.233,"pitch":38.005},{"time":18.242,"pitch":38.004},{"time":18.250,"pitch":38.003},{"time":18.258,"pitch":38.002},{"time":18.275,"pitch":38.001},{"time":18.317,"pitch":38.000},{"time":18.758,"pitch":37.587},{"time":18.767,"pitch":37.260},{"time":18.775,"pitch":37.000},{"time":18.783,"pitch":36.794},{"time":18.792,"pitch":36.630},{"time":18.800,"pitch":36.500},{"time":18.808,"pitch":36.397},{"time":18.817,"pitch":36.315},{"time":18.825,"pitch":36.250},{"time":18.833,"pitch":36.198},{"time":18.842,"pitch":36.157},{"time":18.850,"pitch":36.125},{"time":18.858,"pitch":36.099},{"time":18.867,"pitch":36.079},{"time":18.875,"pitch":36.063},{"time":18.883,"pitch":36.050},{"time":18.892,"pitch":36.039},{"time":18.900,"pitch":36.031},{"time":18.908,"pitch":36.025},{"time":18.917,"pitch":36.020},{"time":18.925,"pitch":36.016},{"time":18.933,"pitch":36.012},{"time":18.942,"pitch":36.010},{"time":18.950,"pitch":36.008},{"time":18.958,"pitch":36.006},{"time":18.967,"pitch":36.005},{"time":18.975,"pitch":36.004},{"time":18.983,"pitch":36.003},{"time":18.992,"pitch":36.002},{"time":19.017,"pitch":36.001},{"time":19.050,"pitch":36.000},{"time":19.258,"pitch":35.381},{"time":19.267,"pitch":34.890},{"time":19.275,"pitch":34.500},{"time":19.283,"pitch":34.191},{"time":19.292,"pitch":33.945},{"time":19.300,"pitch":33.750},{"time":19.308,"pitch":33.595},{"time":19.317,"pitch":33.472},{"time":19.325,"pitch":33.375},{"time":19.333,"pitch":33.298},{"time":19.342,"pitch":33.236},{"time":19.350,"pitch":33.188},{"time":19.358,"pitch":33.149},{"time":19.367,"pitch":33.118},{"time":19.375,"pitch":33.094},{"time":19.383,"pitch":33.074},{"time":19.392,"pitch":33.059},{"time":19.400,"pitch":33.047},{"time":19.408,"pitch":33.037},{"time":19.417,"pitch":33.030},{"time":19.425,"pitch":33.023},{"time":19.433,"pitch":33.019},{"time":19.442,"pitch":33.015},{"time":19.450,"pitch":33.012},{"time":19.458,"pitch":33.009},{"time":19.467,"pitch":33.007},{"time":19.475,"pitch":33.006},{"time":19.483,"pitch":33.005},{"time":19.492,"pitch":33.004},{"time":19.500,"pitch":33.003},{"time":19.508,"pitch":33.621},{"time":19.517,"pitch":34.112},{"time":19.525,"pitch":34.501},{"time":19.533,"pitch":34.811},{"time":19.542,"pitch":35.056},{"time":19.550,"pitch":35.251},{"time":19.558,"pitch":35.405},{"time":19.567,"pitch":35.528},{"time":19.575,"pitch":35.625},{"time":19.583,"pitch":35.703},{"time":19.592,"pitch":35.764},{"time":19.600,"pitch":35.813},{"time":19.608,"pitch":35.851},{"time":19.617,"pitch":35.882},{"time":19.625,"pitch":35.906},{"time":19.633,"pitch":35.926},{"time":19.642,"pitch":35.941},{"time":19.650,"pitch":35.953},{"time":19.658,"pitch":35.963},{"time":19.667,"pitch":35.970},{"time":19.675,"pitch":35.977},{"time":19.683,"pitch":35.981},{"time":19.692,"pitch":35.985},{"time":19.700,"pitch":35.988},{"time":19.708,"pitch":35.991},{"time":19.717,"pitch":35.993},{"time":19.725,"pitch":35.994},{"time":19.733,"pitch":35.995},{"time":19.742,"pitch":35.996},{"time":19.750,"pitch":35.997},{"time":19.758,"pitch":35.998},{"time":19.775,"pitch":35.999},{"time":19.817,"pitch":36.000},{"time":20.000,"pitch":36.413},{"time":20.008,"pitch":36.740},{"time":20.017,"pitch":37.000},{"time":20.025,"pitch":37.206},{"time":20.033,"pitch":37.370},{"time":20.042,"pitch":37.500},{"time":20.050,"pitch":37.603},{"time":20.058,"pitch":37.685},{"time":20.067,"pitch":37.750},{"time":20.075,"pitch":37.802},{"time":20.083,"pitch":37.843},{"time":20.092,"pitch":37.875},{"time":20.100,"pitch":37.901},{"time":20.108,"pitch":37.921},{"time":20.117,"pitch":37.937},{"time":20.125,"pitch":37.950},{"time":20.133,"pitch":37.961},{"time":20.142,"pitch":37.969},{"time":20.150,"pitch":37.975},{"time":20.158,"pitch":37.980},{"time":20.167,"pitch":37.984},{"time":20.175,"pitch":37.988},{"time":20.183,"pitch":37.990},{"time":20.192,"pitch":37.992},{"time":20.200,"pitch":37.994},{"time":20.208,"pitch":37.995},{"time":20.217,"pitch":37.996},{"time":20.225,"pitch":37.997},{"time":20.233,"pitch":37.998},{"time":20.258,"pitch":37.999},{"time":20.292,"pitch":38.000},{"time":20.733,"pitch":38.619},{"time":20.742,"pitch":39.110},{"time":20.750,"pitch":39.500},{"time":20.758,"pitch":39.809},{"time":20.767,"pitch":40.055},{"time":20.775,"pitch":40.250},{"time":20.783,"pitch":40.405},{"time":20.792,"pitch":40.528},{"time":20.800,"pitch":40.625},{"time":20.808,"pitch":40.702},{"time":20.817,"pitch":40.764},{"time":20.825,"pitch":40.812},{"time":20.833,"pitch":40.851},{"time":20.842,"pitch":40.882},{"time":20.850,"pitch":40.906},{"time":20.858,"pitch":40.926},{"time":20.867,"pitch":40.941},{"time":20.875,"pitch":40.953},{"time":20.883,"pitch":40.963},{"time":20.892,"pitch":40.970},{"time":20.900,"pitch":40.977},{"time":20.908,"pitch":40.981},{"time":20.917,"pitch":40.985},{"time":20.925,"pitch":40.988},{"time":20.933,"pitch":40.991},{"time":20.942,"pitch":40.993},{"time":20.950,"pitch":40.994},{"time":20.958,"pitch":40.995},{"time":20.967,"pitch":40.996},{"time":20.975,"pitch":40.997},{"time":20.983,"pitch":40.998},{"time":21.000,"pitch":40.999},{"time":21.042,"pitch":41.000},{"time":21.258,"pitch":40.381},{"time":21.267,"pitch":39.890},{"time":21.275,"pitch":39.500},{"time":21.283,"pitch":39.191},{"time":21.292,"pitch":38.945},{"time":21.300,"pitch":38.750},{"time":21.308,"pitch":38.595},{"time":21.317,"pitch":38.472},{"time":21.325,"pitch":38.375},{"time":21.333,"pitch":38.298},{"time":21.342,"pitch":38.236},{"time":21.350,"pitch":38.187},{"time":21.358,"pitch":38.149},{"time":21.367,"pitch":38.118},{"time":21.375,"pitch":38.094},{"time":21.383,"pitch":38.074},{"time":21.392,"pitch":38.059},{"time":21.400,"pitch":38.047},{"time":21.408,"pitch":38.037},{"time":21.417,"pitch":38.030},{"time":21.425,"pitch":38.023},{"time":21.433,"pitch":38.019},{"time":21.442,"pitch":38.015},{"time":21.450,"pitch":38.012},{"time":21.458,"pitch":38.009},{"time":21.467,"pitch":38.007},{"time":21.475,"pitch":38.006},{"time":21.483,"pitch":38.005},{"time":21.492,"pitch":38.004},{"time":21.500,"pitch":38.622},{"time":21.508,"pitch":39.112},{"time":21.517,"pitch":39.502},{"time":21.525,"pitch":39.811},{"time":21.533,"pitch":40.056},{"time":21.542,"pitch":40.251},{"time":21.550,"pitch":40.405},{"time":21.558,"pitch":40.528},{"time":21.567,"pitch":40.625},{"time":21.575,"pitch":40.703},{"time":21.583,"pitch":40.764},{"time":21.592,"pitch":40.813},{"time":21.600,"pitch":40.851},{"time":21.608,"pitch":40.882},{"time":21.617,"pitch":40.906},{"time":21.625,"pitch":40.926},{"time":21.633,"pitch":40.941},{"time":21.642,"pitch":40.953},{"time":21.650,"pitch":40.963},{"time":21.658,"pitch":40.971},{"time":21.667,"pitch":40.977},{"time":21.675,"pitch":40.981},{"time":21.683,"pitch":40.985},{"time":21.692,"pitch":40.988},{"time":21.700,"pitch":40.991},{"time":21.708,"pitch":40.993},{"time":21.717,"pitch":40.994},{"time":21.725,"pitch":40.995},{"time":21.733,"pitch":40.996},{"time":21.742,"pitch":40.997},{"time":21.750,"pitch":40.998},{"time":21.767,"pitch":40.999},{"time":21.808,"pitch":41.000},{"time":22.008,"pitch":40.381},{"time":22.017,"pitch":39.890},{"time":22.025,"pitch":39.500},{"time":22.033,"pitch":39.191},{"time":22.042,"pitch":38.945},{"time":22.050,"pitch":38.750},{"time":22.058,"pitch":38.595},{"time":22.067,"pitch":38.472},{"time":22.075,"pitch":38.375},{"time":22.083,"pitch":38.298},{"time":22.092,"pitch":38.236},{"time":22.100,"pitch":38.187},{"time":22.108,"pitch":38.149},{"time":22.117,"pitch":38.118},{"time":22.125,"pitch":38.094},{"time":22.133,"pitch":38.074},{"time":22.142,"pitch":38.059},{"time":22.150,"pitch":38.047},{"time":22.158,"pitch":38.037},{"time":22.167,"pitch":38.030},{"time":22.175,"pitch":38.023},{"time":22.183,"pitch":38.019},{"time":22.192,"pitch":38.015},{"time":22.200,"pitch":38.012},{"time":22.208,"pitch":38.009},{"time":22.217,"pitch":38.007},{"time":22.225,"pitch":38.006},{"time":22.233,"pitch":38.005},{"time":22.242,"pitch":38.004},{"time":22.250,"pitch":38.003},{"time":22.258,"pitch":38.002},{"time":22.275,"pitch":38.001},{"time":22.317,"pitch":38.000},{"time":22.758,"pitch":37.587},{"time":22.767,"pitch":37.260},{"time":22.775,"pitch":37.000},{"time":22.783,"pitch":36.794},{"time":22.792,"pitch":36.630},{"time":22.800,"pitch":36.500},{"time":22.808,"pitch":36.397},{"time":22.817,"pitch":36.315},{"time":22.825,"pitch":36.250},{"time":22.833,"pitch":36.198},{"time":22.842,"pitch":36.157},{"time":22.850,"pitch":36.125},{"time":22.858,"pitch":36.099},{"time":22.867,"pitch":36.079},{"time":22.875,"pitch":36.063},{"time":22.883,"pitch":36.050},{"time":22.892,"pitch":36.039},{"time":22.900,"pitch":36.031},{"time":22.908,"pitch":36.025},{"time":22.917,"pitch":36.020},{"time":22.925,"pitch":36.016},{"time":22.933,"pitch":36.012},{"time":22.942,"pitch":36.010},{"time":22.950,"pitch":36.008},{"time":22.958,"pitch":36.006},{"time":22.967,"pitch":36.005},{"time":22.975,"pitch":36.004},{"time":22.983,"pitch":36.003},{"time":22.992,"pitch":36.002},{"time":23.017,"pitch":36.001},{"time":23.050,"pitch":36.000},{"time":23.258,"pitch":35.381},{"time":23.267,"pitch":34.890},{"time":23.275,"pitch":34.500},{"time":23.283,"pitch":34.191},{"time":23.292,"pitch":33.945},{"time":23.300,"pitch":33.750},{"time":23.308,"pitch":33.595},{"time":23.317,"pitch":33.472},{"time":23.325,"pitch":33.375},{"time":23.333,"pitch":33.298},{"time":23.342,"pitch":33.236},{"time":23.350,"pitch":33.188},{"time":23.358,"pitch":33.149},{"time":23.367,"pitch":33.118},{"time":23.375,"pitch":33.094},{"time":23.383,"pitch":33.074},{"time":23.392,"pitch":33.059},{"time":23.400,"pitch":33.047},{"time":23.408,"pitch":33.037},{"time":23.417,"pitch":33.030},{"time":23.425,"pitch":33.023},{"time":23.433,"pitch":33.019},{"time":23.442,"pitch":33.015},{"time":23.450,"pitch":33.012},{"time":23.458,"pitch":33.009},{"time":23.467,"pitch":33.007},{"time":23.475,"pitch":33.006},{"time":23.483,"pitch":33.005},{"time":23.492,"pitch":33.004},{"time":23.500,"pitch":33.003},{"time":23.508,"pitch":33.621},{"time":23.517,"pitch":34.112},{"time":23.525,"pitch":34.501},{"time":23.533,"pitch":34.811},{"time":23.542,"pitch":35.056},{"time":23.550,"pitch":35.251},{"time":23.558,"pitch":35.405},{"time":23.567,"pitch":35.528},{"time":23.575,"pitch":35.625},{"time":23.583,"pitch":35.703},{"time":23.592,"pitch":35.764},{"time":23.600,"pitch":35.813},{"time":23.608,"pitch":35.851},{"time":23.617,"pitch":35.882},{"time":23.625,"pitch":35.906},{"time":23.633,"pitch":35.926},{"time":23.642,"pitch":35.941},{"time":23.650,"pitch":35.953},{"time":23.658,"pitch":35.963},{"time":23.667,"pitch":35.970},{"time":23.675,"pitch":35.977},{"time":23.683,"pitch":35.981},{"time":23.692,"pitch":35.985},{"time":23.700,"pitch":35.988},{"time":23.708,"pitch":35.991},{"time":23.717,"pitch":35.993},{"time":23.725,"pitch":35.994},{"time":23.733,"pitch":35.995},{"time":23.742,"pitch":35.996},{"time":23.750,"pitch":35.997},{"time":23.758,"pitch":35.998},{"time":23.775,"pitch":35.999},{"time":23.817,"pitch":36.000},{"time":24.000,"pitch":36.413},{"time":24.008,"pitch":36.740},{"time":24.017,"pitch":37.000},{"time":24.025,"pitch":37.206},{"time":24.033,"pitch":37.370},{"time":24.042,"pitch":37.500},{"time":24.050,"pitch":37.603},{"time":24.058,"pitch":37.685},{"time":24.067,"pitch":37.750},{"time":24.075,"pitch":37.802},{"time":24.083,"pitch":37.843},{"time":24.092,"pitch":37.875},{"time":24.100,"pitch":37.901},{"time":24.108,"pitch":37.921},{"time":24.117,"pitch":37.937},{"time":24.125,"pitch":37.950},{"time":24.133,"pitch":37.961},{"time":24.142,"pitch":37.969},{"time":24.150,"pitch":37.975},{"time":24.158,"pitch":37.980},{"time":24.167,"pitch":37.984},{"time":24.175,"pitch":37.988},{"time":24.183,"pitch":37.990},{"time":24.192,"pitch":37.992},{"time":24.200,"pitch":37.994},{"time":24.208,"pitch":37.995},{"time":24.217,"pitch":37.996},{"time":24.225,"pitch":37.997},{"time":24.233,"pitch":37.998},{"time":24.258,"pitch":37.999},{"time":24.292,"pitch":38.000},{"time":24.733,"pitch":38.619},{"time":24.742,"pitch":39.110},{"time":24.750,"pitch":39.500},{"time":24.758,"pitch":39.809},{"time":24.767,"pitch":40.055},{"time":24.775,"pitch":40.250},{"time":24.783,"pitch":40.405},{"time":24.792,"pitch":40.528},{"time":24.800,"pitch":40.625},{"time":24.808,"pitch":40.702},{"time":24.817,"pitch":40.764},{"time":24.825,"pitch":40.812},{"time":24.833,"pitch":40.851},{"time":24.842,"pitch":40.882},{"time":24.850,"pitch":40.906},{"time":24.858,"pitch":40.926},{"time":24.867,"pitch":40.941},{"time":24.875,"pitch":40.953},{"time":24.883,"pitch":40.963},{"time":24.892,"pitch":40.970},{"time":24.900,"pitch":40.977},{"time":24.908,"pitch":40.981},{"time":24.917,"pitch":40.985},{"time":24.925,"pitch":40.988},{"time":24.933,"pitch":40.991},{"time":24.942,"pitch":40.993},{"time":24.950,"pitch":40.994},{"time":24.958,"pitch":40.995},{"time":24.967,"pitch":40.996},{"time":24.975,"pitch":40.997},{"time":24.983,"pitch":40.998},{"time":25.000,"pitch":40.999},{"time":25.042,"pitch":41.000},{"time":25.258,"pitch":40.381},{"time":25.267,"pitch":39.890},{"time":25.275,"pitch":39.500},{"time":25.283,"pitch":39.191},{"time":25.292,"pitch":38.945},{"time":25.300,"pitch":38.750},{"time":25.308,"pitch":38.595},{"time":25.317,"pitch":38.472},{"time":25.325,"pitch":38.375},{"time":25.333,"pitch":38.298},{"time":25.342,"pitch":38.236},{"time":25.350,"pitch":38.187},{"time":25.358,"pitch":38.149},{"time":25.367,"pitch":38.118},{"time":25.375,"pitch":38.094},{"time":25.383,"pitch":38.074},{"time":25.392,"pitch":38.059},{"time":25.400,"pitch":38.047},{"time":25.408,"pitch":38.037},{"time":25.417,"pitch":38.030},{"time":25.425,"pitch":38.023},{"time":25.433,"pitch":38.019},{"time":25.442,"pitch":38.015},{"time":25.450,"pitch":38.012},{"time":25.458,"pitch":38.009},{"time":25.467,"pitch":38.007},{"time":25.475,"pitch":38.006},{"time":25.483,"pitch":38.005},{"time":25.492,"pitch":38.004},{"time":25.500,"pitch":38.622},{"time":25.508,"pitch":39.112},{"time":25.517,"pitch":39.502},{"time":25.525,"pitch":39.811},{"time":25.533,"pitch":40.056},{"time":25.542,"pitch":40.251},{"time":25.550,"pitch":40.405},{"time":25.558,"pitch":40.528},{"time":25.567,"pitch":40.625},{"time":25.575,"pitch":40.703},{"time":25.583,"pitch":40.764},{"time":25.592,"pitch":40.813},{"time":25.600,"pitch":40.851},{"time":25.608,"pitch":40.882},{"time":25.617,"pitch":40.906},{"time":25.625,"pitch":40.926},{"time":25.633,"pitch":40.941},{"time":25.642,"pitch":40.953},{"time":25.650,"pitch":40.963},{"time":25.658,"pitch":40.971},{"time":25.667,"pitch":40.977},{"time":25.675,"pitch":40.981},{"time":25.683,"pitch":40.985},{"time":25.692,"pitch":40.988},{"time":25.700,"pitch":40.991},{"time":25.708,"pitch":40.993},{"time":25.717,"pitch":40.994},{"time":25.725,"pitch":40.995},{"time":25.733,"pitch":40.996},{"time":25.742,"pitch":40.997},{"time":25.750,"pitch":40.998},{"time":25.767,"pitch":40.999},{"time":25.808,"pitch":41.000},{"time":26.008,"pitch":40.381},{"time":26.017,"pitch":39.890},{"time":26.025,"pitch":39.500},{"time":26.033,"pitch":39.191},{"time":26.042,"pitch":38.945},{"time":26.050,"pitch":38.750},{"time":26.058,"pitch":38.595},{"time":26.067,"pitch":38.472},{"time":26.075,"pitch":38.375},{"time":26.083,"pitch":38.298},{"time":26.092,"pitch":38.236},{"time":26.100,"pitch":38.187},{"time":26.108,"pitch":38.149},{"time":26.117,"pitch":38.118},{"time":26.125,"pitch":38.094},{"time":26.133,"pitch":38.074},{"time":26.142,"pitch":38.059},{"time":26.150,"pitch":38.047},{"time":26.158,"pitch":38.037},{"time":26.167,"pitch":38.030},{"time":26.175,"pitch":38.023},{"time":26.183,"pitch":38.019},{"time":26.192,"pitch":38.015},{"time":26.200,"pitch":38.012},{"time":26.208,"pitch":38.009},{"time":26.217,"pitch":38.007},{"time":26.225,"pitch":38.006},{"time":26.233,"pitch":38.005},{"time":26.242,"pitch":38.004},{"time":26.250,"pitch":38.003},{"time":26.258,"pitch":38.002},{"time":26.275,"pitch":38.001},{"time":26.317,"pitch":38.000},{"time":26.758,"pitch":37.587},{"time":26.767,"pitch":37.260},{"time":26.775,"pitch":37.000},{"time":26.783,"pitch":36.794},{"time":26.792,"pitch":36.630},{"time":26.800,"pitch":36.500},{"time":26.808,"pitch":36.397},{"time":26.817,"pitch":36.315},{"time":26.825,"pitch":36.250},{"time":26.833,"pitch":36.198},{"time":26.842,"pitch":36.157},{"time":26.850,"pitch":36.125},{"time":26.858,"pitch":36.099},{"time":26.867,"pitch":36.079},{"time":26.875,"pitch":36.063},{"time":26.883,"pitch":36.050},{"time":26.892,"pitch":36.039},{"time":26.900,"pitch":36.031},{"time":26.908,"pitch":36.025},{"time":26.917,"pitch":36.020},{"time":26.925,"pitch":36.016},{"time":26.933,"pitch":36.012},{"time":26.942,"pitch":36.010},{"time":26.950,"pitch":36.008},{"time":26.958,"pitch":36.006},{"time":26.967,"pitch":36.005},{"time":26.975,"pitch":36.004},{"time":26.983,"pitch":36.003},{"time":26.992,"pitch":36.002},{"time":27.017,"pitch":36.001},{"time":27.050,"pitch":36.000},{"time":27.258,"pitch":35.381},{"time":27.267,"pitch":34.890},{"time":27.275,"pitch":34.500},{"time":27.283,"pitch":34.191},{"time":27.292,"pitch":33.945},{"time":27.300,"pitch":33.750},{"time":27.308,"pitch":33.595},{"time":27.317,"pitch":33.472},{"time":27.325,"pitch":33.375},{"time":27.333,"pitch":33.298},{"time":27.342,"pitch":33.236},{"time":27.350,"pitch":33.188},{"time":27.358,"pitch":33.149},{"time":27.367,"pitch":33.118},{"time":27.375,"pitch":33.094},{"time":27.383,"pitch":33.074},{"time":27.392,"pitch":33.059},{"time":27.400,"pitch":33.047},{"time":27.408,"pitch":33.037},{"time":27.417,"pitch":33.030},{"time":27.425,"pitch":33.023},{"time":27.433,"pitch":33.019},{"time":27.442,"pitch":33.015},{"time":27.450,"pitch":33.012},{"time":27.458,"pitch":33.009},{"time":27.467,"pitch":33.007},{"time":27.475,"pitch":33.006},{"time":27.483,"pitch":33.005},{"time":27.492,"pitch":33.004},{"time":27.500,"pitch":33.003},{"time":27.508,"pitch":33.621},{"time":27.517,"pitch":34.112},{"time":27.525,"pitch":34.501},{"time":27.533,"pitch":34.811},{"time":27.542,"pitch":35.056},{"time":27.550,"pitch":35.251},{"time":27.558,"pitch":35.405},{"time":27.567,"pitch":35.528},{"time":27.575,"pitch":35.625},{"time":27.583,"pitch":35.703},{"time":27.592,"pitch":35.764},{"time":27.600,"pitch":35.813},{"time":27.608,"pitch":35.851},{"time":27.617,"pitch":35.882},{"time":27.625,"pitch":35.906},{"time":27.633,"pitch":35.926},{"time":27.642,"pitch":35.941},{"time":27.650,"pitch":35.953},{"time":27.658,"pitch":35.963},{"time":27.667,"pitch":35.970},{"time":27.675,"pitch":35.977},{"time":27.683,"pitch":35.981},{"time":27.692,"pitch":35.985},{"time":27.700,"pitch":35.988},{"time":27.708,"pitch":35.991},{"time":27.717,"pitch":35.993},{"time":27.725,"pitch":35.994},{"time":27.733,"pitch":35.995},{"time":27.742,"pitch":35.996},{"time":27.750,"pitch":35.997},{"time":27.758,"pitch":35.998},{"time":27.775,"pitch":35.999},{"time":27.817,"pitch":36.000},{"time":28.000,"pitch":36.413},{"time":28.008,"pitch":36.740},{"time":28.017,"pitch":37.000},{"time":28.025,"pitch":37.206},{"time":28.033,"pitch":37.370},{"time":28.042,"pitch":37.500},{"time":28.050,"pitch":37.603},{"time":28.058,"pitch":37.685},{"time":28.067,"pitch":37.750},{"time":28.075,"pitch":37.802},{"time":28.083,"pitch":37.843},{"time":28.092,"pitch":37.875},{"time":28.100,"pitch":37.901},{"time":28.108,"pitch":37.921},{"time":28.117,"pitch":37.937},{"time":28.125,"pitch":37.950},{"time":28.133,"pitch":37.961},{"time":28.142,"pitch":37.969},{"time":28.150,"pitch":37.975},{"time":28.158,"pitch":37.980},{"time":28.167,"pitch":37.984},{"time":28.175,"pitch":37.988},{"time":28.183,"pitch":37.990},{"time":28.192,"pitch":37.992},{"time":28.200,"pitch":37.994},{"time":28.208,"pitch":37.995},{"time":28.217,"pitch":37.996},{"time":28.225,"pitch":37.997},{"time":28.233,"pitch":37.998},{"time":28.258,"pitch":37.999},{"time":28.292,"pitch":38.000},{"time":28.733,"pitch":38.619},{"time":28.742,"pitch":39.110},{"time":28.750,"pitch":39.500},{"time":28.758,"pitch":39.809},{"time":28.767,"pitch":40.055},{"time":28.775,"pitch":40.250},{"time":28.783,"pitch":40.405},{"time":28.792,"pitch":40.528},{"time":28.800,"pitch":40.625},{"time":28.808,"pitch":40.702},{"time":28.817,"pitch":40.764},{"time":28.825,"pitch":40.812},{"time":28.833,"pitch":40.851},{"time":28.842,"pitch":40.882},{"time":28.850,"pitch":40.906},{"time":28.858,"pitch":40.926},{"time":28.867,"pitch":40.941},{"time":28.875,"pitch":40.953},{"time":28.883,"pitch":40.963},{"time":28.892,"pitch":40.970},{"time":28.900,"pitch":40.977},{"time":28.908,"pitch":40.981},{"time":28.917,"pitch":40.985},{"time":28.925,"pitch":40.988},{"time":28.933,"pitch":40.991},{"time":28.942,"pitch":40.993},{"time":28.950,"pitch":40.994},{"time":28.958,"pitch":40.995},{"time":28.967,"pitch":40.996},{"time":28.975,"pitch":40.997},{"time":28.983,"pitch":40.998},{"time":29.000,"pitch":40.999},{"time":29.042,"pitch":41.000},{"time":29.225,"pitch":41.619},{"time":29.233,"pitch":42.110},{"time":29.242,"pitch":42.500},{"time":29.250,"pitch":42.809},{"time":29.258,"pitch":43.055},{"time":29.267,"pitch":43.250},{"time":29.275,"pitch":43.405},{"time":29.283,"pitch":43.528},{"time":29.292,"pitch":43.625},{"time":29.300,"pitch":43.702},{"time":29.308,"pitch":43.764},{"time":29.317,"pitch":43.812},{"time":29.325,"pitch":43.851},{"time":29.333,"pitch":43.882},{"time":29.342,"pitch":43.906},{"time":29.350,"pitch":43.926},{"time":29.358,"pitch":43.941},{"time":29.367,"pitch":43.953},{"time":29.375,"pitch":43.963},{"time":29.383,"pitch":43.970},{"time":29.392,"pitch":43.977},{"time":29.400,"pitch":43.981},{"time":29.408,"pitch":43.985},{"time":29.417,"pitch":43.988},{"time":29.425,"pitch":43.991},{"time":29.433,"pitch":43.993},{"time":29.442,"pitch":43.994},{"time":29.450,"pitch":43.995},{"time":29.458,"pitch":43.996},{"time":29.467,"pitch":43.997},{"time":29.475,"pitch":43.998},{"time":29.492,"pitch":43.999},{"time":29.525,"pitch":43.793},{"time":29.533,"pitch":43.629},{"time":29.542,"pitch":43.500},{"time":29.550,"pitch":43.397},{"time":29.558,"pitch":43.315},{"time":29.567,"pitch":43.250},{"time":29.575,"pitch":43.198},{"time":29.583,"pitch":43.157},{"time":29.592,"pitch":43.125},{"time":29.600,"pitch":43.099},{"time":29.608,"pitch":43.079},{"time":29.617,"pitch":43.062},{"time":29.625,"pitch":43.050},{"time":29.633,"pitch":43.039},{"time":29.642,"pitch":43.031},{"time":29.650,"pitch":43.025},{"time":29.658,"pitch":43.020},{"time":29.667,"pitch":43.016},{"time":29.675,"pitch":43.012},{"time":29.683,"pitch":43.010},{"time":29.692,"pitch":43.008},{"time":29.700,"pitch":43.006},{"time":29.708,"pitch":43.005},{"time":29.717,"pitch":43.004},{"time":29.725,"pitch":43.003},{"time":29.733,"pitch":43.002},{"time":29.758,"pitch":43.001},{"time":29.792,"pitch":43.000},{"time":30.000,"pitch":42.587},{"time":30.008,"pitch":42.260},{"time":30.017,"pitch":42.000},{"time":30.025,"pitch":41.794},{"time":30.033,"pitch":41.630},{"time":30.042,"pitch":41.500},{"time":30.050,"pitch":41.397},{"time":30.058,"pitch":41.315},{"time":30.067,"pitch":41.250},{"time":30.075,"pitch":41.198},{"time":30.083,"pitch":41.157},{"time":30.092,"pitch":41.125},{"time":30.100,"pitch":41.099},{"time":30.108,"pitch":41.079},{"time":30.117,"pitch":41.063},{"time":30.125,"pitch":41.050},{"time":30.133,"pitch":41.039},{"time":30.142,"pitch":41.031},{"time":30.150,"pitch":41.025},{"time":30.158,"pitch":41.020},{"time":30.167,"pitch":41.016},{"time":30.175,"pitch":41.012},{"time":30.183,"pitch":41.010},{"time":30.192,"pitch":41.008},{"time":30.200,"pitch":41.006},{"time":30.208,"pitch":41.005},{"time":30.217,"pitch":41.004},{"time":30.225,"pitch":41.003},{"time":30.233,"pitch":41.002},{"time":30.258,"pitch":41.001},{"time":30.292,"pitch":41.000},{"time":30.758,"pitch":40.381},{"time":30.767,"pitch":39.890},{"time":30.775,"pitch":39.500},{"time":30.783,"pitch":39.191},{"time":30.792,"pitch":38.945},{"time":30.800,"pitch":38.750},{"time":30.808,"pitch":38.595},{"time":30.817,"pitch":38.472},{"time":30.825,"pitch":38.375},{"time":30.833,"pitch":38.298},{"time":30.842,"pitch":38.236},{"time":30.850,"pitch":38.188},{"time":30.858,"pitch":38.149},{"time":30.867,"pitch":38.118},{"time":30.875,"pitch":38.094},{"time":30.883,"pitch":38.074},{"time":30.892,"pitch":38.059},{"time":30.900,"pitch":38.047},{"time":30.908,"pitch":38.037},{"time":30.917,"pitch":38.030},{"time":30.925,"pitch":38.023},{"time":30.933,"pitch":38.019},{"time":30.942,"pitch":38.015},{"time":30.950,"pitch":38.012},{"time":30.958,"pitch":38.009},{"time":30.967,"pitch":38.007},{"time":30.975,"pitch":38.006},{"time":30.983,"pitch":38.005},{"time":30.992,"pitch":38.004},{"time":31.000,"pitch":38.003},{"time":31.008,"pitch":38.002},{"time":31.025,"pitch":38.001},{"time":31.067,"pitch":38.000},{"time":31.208,"pitch":36.969},{"time":31.217,"pitch":36.150},{"time":31.225,"pitch":35.500},{"time":31.233,"pitch":34.984},{"time":31.242,"pitch":34.575},{"time":31.250,"pitch":34.250},{"time":31.258,"pitch":33.992},{"time":31.267,"pitch":33.787},{"time":31.275,"pitch":33.625},{"time":31.283,"pitch":33.496},{"time":31.292,"pitch":33.394},{"time":31.300,"pitch":33.313},{"time":31.308,"pitch":33.248},{"time":31.317,"pitch":33.197},{"time":31.325,"pitch":33.156},{"time":31.333,"pitch":33.124},{"time":31.342,"pitch":33.098},{"time":31.350,"pitch":33.078},{"time":31.358,"pitch":33.062},{"time":31.367,"pitch":33.049},{"time":31.375,"pitch":33.039},{"time":31.383,"pitch":33.031},{"time":31.392,"pitch":33.025},{"time":31.400,"pitch":33.020},{"time":31.408,"pitch":33.016},{"time":31.417,"pitch":33.012},{"time":31.425,"pitch":33.010},{"time":31.433,"pitch":33.008},{"time":31.442,"pitch":33.006},{"time":31.450,"pitch":33.005},{"time":31.458,"pitch":33.004},{"time":31.467,"pitch":33.003},{"time":31.475,"pitch":33.002},{"time":31.500,"pitch":33.001},{"time":31.508,"pitch":33.620},{"time":31.517,"pitch":34.111},{"time":31.525,"pitch":34.501},{"time":31.533,"pitch":34.810},{"time":31.542,"pitch":35.055},{"time":31.550,"pitch":35.250},{"time":31.558,"pitch":35.405},{"time":31.567,"pitch":35.528},{"time":31.575,"pitch":35.625},{"time":31.583,"pitch":35.702},{"time":31.592,"pitch":35.764},{"time":31.600,"pitch":35.813},{"time":31.608,"pitch":35.851},{"time":31.617,"pitch":35.882},{"time":31.625,"pitch":35.906},{"time":31.633,"pitch":35.926},{"time":31.642,"pitch":35.941},{"time":31.650,"pitch":35.953},{"time":31.658,"pitch":35.963},{"time":31.667,"pitch":35.970},{"time":31.675,"pitch":35.977},{"time":31.683,"pitch":35.981},{"time":31.692,"pitch":35.985},{"time":31.700,"pitch":35.988},{"time":31.708,"pitch":35.991},{"time":31.717,"pitch":35.993},{"time":31.725,"pitch":35.994},{"time":31.733,"pitch":35.995},{"time":31.742,"pitch":35.996},{"time":31.750,"pitch":35.997},{"time":31.758,"pitch":35.998},{"time":31.775,"pitch":35.999},{"time":31.817,"pitch":36.000},{"time":32.000,"pitch":36.413},{"time":32.008,"pitch":36.740},{"time":32.017,"pitch":37.000},{"time":32.025,"pitch":37.206},{"time":32.033,"pitch":37.370},{"time":32.042,"pitch":37.500},{"time":32.050,"pitch":37.603},{"time":32.058,"pitch":37.685},{"time":32.067,"pitch":37.750},{"time":32.075,"pitch":37.802},{"time":32.083,"pitch":37.843},{"time":32.092,"pitch":37.875},{"time":32.100,"pitch":37.901},{"time":32.108,"pitch":37.921},{"time":32.117,"pitch":37.937},{"time":32.125,"pitch":37.950},{"time":32.133,"pitch":37.961},{"time":32.142,"pitch":37.969},{"time":32.150,"pitch":37.975},{"time":32.158,"pitch":37.980},{"time":32.167,"pitch":37.984},{"time":32.175,"pitch":37.988},{"time":32.183,"pitch":37.990},{"time":32.192,"pitch":37.992},{"time":32.200,"pitch":37.994},{"time":32.208,"pitch":37.995},{"time":32.217,"pitch":37.996},{"time":32.225,"pitch":37.997},{"time":32.233,"pitch":37.998},{"time":32.258,"pitch":37.999},{"time":32.292,"pitch":38.000},{"time":32.733,"pitch":38.619},{"time":32.742,"pitch":39.110},{"time":32.750,"pitch":39.500},{"time":32.758,"pitch":39.809},{"time":32.767,"pitch":40.055},{"time":32.775,"pitch":40.250},{"time":32.783,"pitch":40.405},{"time":32.792,"pitch":40.528},{"time":32.800,"pitch":40.625},{"time":32.808,"pitch":40.702},{"time":32.817,"pitch":40.764},{"time":32.825,"pitch":40.812},{"time":32.833,"pitch":40.851},{"time":32.842,"pitch":40.882},{"time":32.850,"pitch":40.906},{"time":32.858,"pitch":40.926},{"time":32.867,"pitch":40.941},{"time":32.875,"pitch":40.953},{"time":32.883,"pitch":40.963},{"time":32.892,"pitch":40.970},{"time":32.900,"pitch":40.977},{"time":32.908,"pitch":40.981},{"time":32.917,"pitch":40.985},{"time":32.925,"pitch":40.988},{"time":32.933,"pitch":40.991},{"time":32.942,"pitch":40.993},{"time":32.950,"pitch":40.994},{"time":32.958,"pitch":40.995},{"time":32.967,"pitch":40.996},{"time":32.975,"pitch":40.997},{"time":32.983,"pitch":40.998},{"time":33.000,"pitch":40.999},{"time":33.042,"pitch":41.000},{"time":33.258,"pitch":40.381},{"time":33.267,"pitch":39.890},{"time":33.275,"pitch":39.500},{"time":33.283,"pitch":39.191},{"time":33.292,"pitch":38.945},{"time":33.300,"pitch":38.750},{"time":33.308,"pitch":38.595},{"time":33.317,"pitch":38.472},{"time":33.325,"pitch":38.375},{"time":33.333,"pitch":38.298},{"time":33.342,"pitch":38.236},{"time":33.350,"pitch":38.187},{"time":33.358,"pitch":38.149},{"time":33.367,"pitch":38.118},{"time":33.375,"pitch":38.094},{"time":33.383,"pitch":38.074},{"time":33.392,"pitch":38.059},{"time":33.400,"pitch":38.047},{"time":33.408,"pitch":38.037},{"time":33.417,"pitch":38.030},{"time":33.425,"pitch":38.023},{"time":33.433,"pitch":38.019},{"time":33.442,"pitch":38.015},{"time":33.450,"pitch":38.012},{"time":33.458,"pitch":38.009},{"time":33.467,"pitch":38.007},{"time":33.475,"pitch":38.006},{"time":33.483,"pitch":38.005},{"time":33.492,"pitch":38.004},{"time":33.500,"pitch":38.622},{"time":33.508,"pitch":39.112},{"time":33.517,"pitch":39.502},{"time":33.525,"pitch":39.811},{"time":33.533,"pitch":40.056},{"time":33.542,"pitch":40.251},{"time":33.550,"pitch":40.405},{"time":33.558,"pitch":40.528},{"time":33.567,"pitch":40.625},{"time":33.575,"pitch":40.703},{"time":33.583,"pitch":40.764},{"time":33.592,"pitch":40.813},{"time":33.600,"pitch":40.851},{"time":33.608,"pitch":40.882},{"time":33.617,"pitch":40.906},{"time":33.625,"pitch":40.926},{"time":33.633,"pitch":40.941},{"time":33.642,"pitch":40.953},{"time":33.650,"pitch":40.963},{"time":33.658,"pitch":40.971},{"time":33.667,"pitch":40.977},{"time":33.675,"pitch":40.981},{"time":33.683,"pitch":40.985},{"time":33.692,"pitch":40.988},{"time":33.700,"pitch":40.991},{"time":33.708,"pitch":40.993},{"time":33.717,"pitch":40.994},{"time":33.725,"pitch":40.995},{"time":33.733,"pitch":40.996},{"time":33.742,"pitch":40.997},{"time":33.750,"pitch":40.998},{"time":33.767,"pitch":40.999},{"time":33.808,"pitch":41.000},{"time":34.008,"pitch":40.381},{"time":34.017,"pitch":39.890},{"time":34.025,"pitch":39.500},{"time":34.033,"pitch":39.191},{"time":34.042,"pitch":38.945},{"time":34.050,"pitch":38.750},{"time":34.058,"pitch":38.595},{"time":34.067,"pitch":38.472},{"time":34.075,"pitch":38.375},{"time":34.083,"pitch":38.298},{"time":34.092,"pitch":38.236},{"time":34.100,"pitch":38.187},{"time":34.108,"pitch":38.149},{"time":34.117,"pitch":38.118},{"time":34.125,"pitch":38.094},{"time":34.133,"pitch":38.074},{"time":34.142,"pitch":38.059},{"time":34.150,"pitch":38.047},{"time":34.158,"pitch":38.037},{"time":34.167,"pitch":38.030},{"time":34.175,"pitch":38.023},{"time":34.183,"pitch":38.019},{"time":34.192,"pitch":38.015},{"time":34.200,"pitch":38.012},{"time":34.208,"pitch":38.009},{"time":34.217,"pitch":38.007},{"time":34.225,"pitch":38.006},{"time":34.233,"pitch":38.005},{"time":34.242,"pitch":38.004},{"time":34.250,"pitch":38.003},{"time":34.258,"pitch":38.002},{"time":34.275,"pitch":38.001},{"time":34.317,"pitch":38.000},{"time":34.758,"pitch":37.587},{"time":34.767,"pitch":37.260},{"time":34.775,"pitch":37.000},{"time":34.783,"pitch":36.794},{"time":34.792,"pitch":36.630},{"time":34.800,"pitch":36.500},{"time":34.808,"pitch":36.397},{"time":34.817,"pitch":36.315},{"time":34.825,"pitch":36.250},{"time":34.833,"pitch":36.198},{"time":34.842,"pitch":36.157},{"time":34.850,"pitch":36.125},{"time":34.858,"pitch":36.099},{"time":34.867,"pitch":36.079},{"time":34.875,"pitch":36.063},{"time":34.883,"pitch":36.050},{"time":34.892,"pitch":36.039},{"time":34.900,"pitch":36.031},{"time":34.908,"pitch":36.025},{"time":34.917,"pitch":36.020},{"time":34.925,"pitch":36.016},{"time":34.933,"pitch":36.012},{"time":34.942,"pitch":36.010},{"time":34.950,"pitch":36.008},{"time":34.958,"pitch":36.006},{"time":34.967,"pitch":36.005},{"time":34.975,"pitch":36.004},{"time":34.983,"pitch":36.003},{"time":34.992,"pitch":36.002},{"time":35.017,"pitch":36.001},{"time":35.050,"pitch":36.000},{"time":35.258,"pitch":35.381},{"time":35.267,"pitch":34.890},{"time":35.275,"pitch":34.500},{"time":35.283,"pitch":34.191},{"time":35.292,"pitch":33.945},{"time":35.300,"pitch":33.750},{"time":35.308,"pitch":33.595},{"time":35.317,"pitch":33.472},{"time":35.325,"pitch":33.375},{"time":35.333,"pitch":33.298},{"time":35.342,"pitch":33.236},{"time":35.350,"pitch":33.188},{"time":35.358,"pitch":33.149},{"time":35.367,"pitch":33.118},{"time":35.375,"pitch":33.094},{"time":35.383,"pitch":33.074},{"time":35.392,"pitch":33.059},{"time":35.400,"pitch":33.047},{"time":35.408,"pitch":33.037},{"time":35.417,"pitch":33.030},{"time":35.425,"pitch":33.023},{"time":35.433,"pitch":33.019},{"time":35.442,"pitch":33.015},{"time":35.450,"pitch":33.012},{"time":35.458,"pitch":33.009},{"time":35.467,"pitch":33.007},{"time":35.475,"pitch":33.006},{"time":35.483,"pitch":33.005},{"time":35.492,"pitch":33.004},{"time":35.500,"pitch":33.003},{"time":35.508,"pitch":33.621},{"time":35.517,"pitch":34.112},{"time":35.525,"pitch":34.501},{"time":35.533,"pitch":34.811},{"time":35.542,"pitch":35.056},{"time":35.550,"pitch":35.251},{"time":35.558,"pitch":35.405},{"time":35.567,"pitch":35.528},{"time":35.575,"pitch":35.625},{"time":35.583,"pitch":35.703},{"time":35.592,"pitch":35.764},{"time":35.600,"pitch":35.813},{"time":35.608,"pitch":35.851},{"time":35.617,"pitch":35.882},{"time":35.625,"pitch":35.906},{"time":35.633,"pitch":35.926},{"time":35.642,"pitch":35.941},{"time":35.650,"pitch":35.953},{"time":35.658,"pitch":35.963},{"time":35.667,"pitch":35.970},{"time":35.675,"pitch":35.977},{"time":35.683,"pitch":35.981},{"time":35.692,"pitch":35.985},{"time":35.700,"pitch":35.988},{"time":35.708,"pitch":35.991},{"time":35.717,"pitch":35.993},{"time":35.725,"pitch":35.994},{"time":35.733,"pitch":35.995},{"time":35.742,"pitch":35.996},{"time":35.750,"pitch":35.997},{"time":35.758,"pitch":35.998},{"time":35.775,"pitch":35.999},{"time":35.817,"pitch":36.000},{"time":36.000,"pitch":36.413},{"time":36.008,"pitch":36.740},{"time":36.017,"pitch":37.000},{"time":36.025,"pitch":37.206},{"time":36.033,"pitch":37.370},{"time":36.042,"pitch":37.500},{"time":36.050,"pitch":37.603},{"time":36.058,"pitch":37.685},{"time":36.067,"pitch":37.750},{"time":36.075,"pitch":37.802},{"time":36.083,"pitch":37.843},{"time":36.092,"pitch":37.875},{"time":36.100,"pitch":37.901},{"time":36.108,"pitch":37.921},{"time":36.117,"pitch":37.937},{"time":36.125,"pitch":37.950},{"time":36.133,"pitch":37.961},{"time":36.142,"pitch":37.969},{"time":36.150,"pitch":37.975},{"time":36.158,"pitch":37.980},{"time":36.167,"pitch":37.984},{"time":36.175,"pitch":37.988},{"time":36.183,"pitch":37.990},{"time":36.192,"pitch":37.992},{"time":36.200,"pitch":37.994},{"time":36.208,"pitch":37.995},{"time":36.217,"pitch":37.996},{"time":36.225,"pitch":37.997},{"time":36.233,"pitch":37.998},{"time":36.258,"pitch":37.999},{"time":36.292,"pitch":38.000},{"time":36.733,"pitch":38.619},{"time":36.742,"pitch":39.110},{"time":36.750,"pitch":39.500},{"time":36.758,"pitch":39.809},{"time":36.767,"pitch":40.055},{"time":36.775,"pitch":40.250},{"time":36.783,"pitch":40.405},{"time":36.792,"pitch":40.528},{"time":36.800,"pitch":40.625},{"time":36.808,"pitch":40.702},{"time":36.817,"pitch":40.764},{"time":36.825,"pitch":40.812},{"time":36.833,"pitch":40.851},{"time":36.842,"pitch":40.882},{"time":36.850,"pitch":40.906},{"time":36.858,"pitch":40.926},{"time":36.867,"pitch":40.941},{"time":36.875,"pitch":40.953},{"time":36.883,"pitch":40.963},{"time":36.892,"pitch":40.970},{"time":36.900,"pitch":40.977},{"time":36.908,"pitch":40.981},{"time":36.917,"pitch":40.985},{"time":36.925,"pitch":40.988},{"time":36.933,"pitch":40.991},{"time":36.942,"pitch":40.993},{"time":36.950,"pitch":40.994},{"time":36.958,"pitch":40.995},{"time":36.967,"pitch":40.996},{"time":36.975,"pitch":40.997},{"time":36.983,"pitch":40.998},{"time":37.000,"pitch":40.999},{"time":37.042,"pitch":41.000},{"time":37.225,"pitch":41.619},{"time":37.233,"pitch":42.110},{"time":37.242,"pitch":42.500},{"time":37.250,"pitch":42.809},{"time":37.258,"pitch":43.055},{"time":37.267,"pitch":43.250},{"time":37.275,"pitch":43.405},{"time":37.283,"pitch":43.528},{"time":37.292,"pitch":43.625},{"time":37.300,"pitch":43.702},{"time":37.308,"pitch":43.764},{"time":37.317,"pitch":43.812},{"time":37.325,"pitch":43.851},{"time":37.333,"pitch":43.882},{"time":37.342,"pitch":43.906},{"time":37.350,"pitch":43.926},{"time":37.358,"pitch":43.941},{"time":37.367,"pitch":43.953},{"time":37.375,"pitch":43.963},{"time":37.383,"pitch":43.970},{"time":37.392,"pitch":43.977},{"time":37.400,"pitch":43.981},{"time":37.408,"pitch":43.985},{"time":37.417,"pitch":43.988},{"time":37.425,"pitch":43.991},{"time":37.433,"pitch":43.993},{"time":37.442,"pitch":43.994},{"time":37.450,"pitch":43.995},{"time":37.458,"pitch":43.996},{"time":37.467,"pitch":43.997},{"time":37.475,"pitch":43.998},{"time":37.492,"pitch":43.999},{"time":37.525,"pitch":43.793},{"time":37.533,"pitch":43.629},{"time":37.542,"pitch":43.500},{"time":37.550,"pitch":43.397},{"time":37.558,"pitch":43.315},{"time":37.567,"pitch":43.250},{"time":37.575,"pitch":43.198},{"time":37.583,"pitch":43.157},{"time":37.592,"pitch":43.125},{"time":37.600,"pitch":43.099},{"time":37.608,"pitch":43.079},{"time":37.617,"pitch":43.062},{"time":37.625,"pitch":43.050},{"time":37.633,"pitch":43.039},{"time":37.642,"pitch":43.031},{"time":37.650,"pitch":43.025},{"time":37.658,"pitch":43.020},{"time":37.667,"pitch":43.016},{"time":37.675,"pitch":43.012},{"time":37.683,"pitch":43.010},{"time":37.692,"pitch":43.008},{"time":37.700,"pitch":43.006},{"time":37.708,"pitch":43.005},{"time":37.717,"pitch":43.004},{"time":37.725,"pitch":43.003},{"time":37.733,"pitch":43.002},{"time":37.758,"pitch":43.001},{"time":37.792,"pitch":43.000},{"time":38.000,"pitch":42.587},{"time":38.008,"pitch":42.260},{"time":38.017,"pitch":42.000},{"time":38.025,"pitch":41.794},{"time":38.033,"pitch":41.630},{"time":38.042,"pitch":41.500},{"time":38.050,"pitch":41.397},{"time":38.058,"pitch":41.315},{"time":38.067,"pitch":41.250},{"time":38.075,"pitch":41.198},{"time":38.083,"pitch":41.157},{"time":38.092,"pitch":41.125},{"time":38.100,"pitch":41.099},{"time":38.108,"pitch":41.079},{"time":38.117,"pitch":41.063},{"time":38.125,"pitch":41.050},{"time":38.133,"pitch":41.039},{"time":38.142,"pitch":41.031},{"time":38.150,"pitch":41.025},{"time":38.158,"pitch":41.020},{"time":38.167,"pitch":41.016},{"time":38.175,"pitch":41.012},{"time":38.183,"pitch":41.010},{"time":38.192,"pitch":41.008},{"time":38.200,"pitch":41.006},{"time":38.208,"pitch":41.005},{"time":38.217,"pitch":41.004},{"time":38.225,"pitch":41.003},{"time":38.233,"pitch":41.002},{"time":38.258,"pitch":41.001},{"time":38.292,"pitch":41.000},{"time":38.758,"pitch":40.381},{"time":38.767,"pitch":39.890},{"time":38.775,"pitch":39.500},{"time":38.783,"pitch":39.191},{"time":38.792,"pitch":38.945},{"time":38.800,"pitch":38.750},{"time":38.808,"pitch":38.595},{"time":38.817,"pitch":38.472},{"time":38.825,"pitch":38.375},{"time":38.833,"pitch":38.298},{"time":38.842,"pitch":38.236},{"time":38.850,"pitch":38.188},{"time":38.858,"pitch":38.149},{"time":38.867,"pitch":38.118},{"time":38.875,"pitch":38.094},{"time":38.883,"pitch":38.074},{"time":38.892,"pitch":38.059},{"time":38.900,"pitch":38.047},{"time":38.908,"pitch":38.037},{"time":38.917,"pitch":38.030},{"time":38.925,"pitch":38.023},{"time":38.933,"pitch":38.019},{"time":38.942,"pitch":38.015},{"time":38.950,"pitch":38.012},{"time":38.958,"pitch":38.009},{"time":38.967,"pitch":38.007},{"time":38.975,"pitch":38.006},{"time":38.983,"pitch":38.005},{"time":38.992,"pitch":38.004},{"time":39.000,"pitch":38.003},{"time":39.008,"pitch":38.002},{"time":39.025,"pitch":38.001},{"time":39.067,"pitch":38.000},{"time":39.208,"pitch":36.969},{"time":39.217,"pitch":36.150},{"time":39.225,"pitch":35.500},{"time":39.233,"pitch":34.984},{"time":39.242,"pitch":34.575},{"time":39.250,"pitch":34.250},{"time":39.258,"pitch":33.992},{"time":39.267,"pitch":33.787},{"time":39.275,"pitch":33.625},{"time":39.283,"pitch":33.496},{"time":39.292,"pitch":33.394},{"time":39.300,"pitch":33.313},{"time":39.308,"pitch":33.248},{"time":39.317,"pitch":33.197},{"time":39.325,"pitch":33.156},{"time":39.333,"pitch":33.124},{"time":39.342,"pitch":33.098},{"time":39.350,"pitch":33.078},{"time":39.358,"pitch":33.062},{"time":39.367,"pitch":33.049},{"time":39.375,"pitch":33.039},{"time":39.383,"pitch":33.031},{"time":39.392,"pitch":33.025},{"time":39.400,"pitch":33.020},{"time":39.408,"pitch":33.016},{"time":39.417,"pitch":33.012},{"time":39.425,"pitch":33.010},{"time":39.433,"pitch":33.008},{"time":39.442,"pitch":33.006},{"time":39.450,"pitch":33.005},{"time":39.458,"pitch":33.004},{"time":39.467,"pitch":33.003},{"time":39.475,"pitch":33.002},{"time":39.500,"pitch":33.001},{"time":39.508,"pitch":33.620},{"time":39.517,"pitch":34.111},{"time":39.525,"pitch":34.501},{"time":39.533,"pitch":34.810},{"time":39.542,"pitch":35.055},{"time":39.550,"pitch":35.250},{"time":39.558,"pitch":35.405},{"time":39.567,"pitch":35.528},{"time":39.575,"pitch":35.625},{"time":39.583,"pitch":35.702},{"time":39.592,"pitch":35.764},{"time":39.600,"pitch":35.813},{"time":39.608,"pitch":35.851},{"time":39.617,"pitch":35.882},{"time":39.625,"pitch":35.906},{"time":39.633,"pitch":35.926},{"time":39.642,"pitch":35.941},{"time":39.650,"pitch":35.953},{"time":39.658,"pitch":35.963},{"time":39.667,"pitch":35.970},{"time":39.675,"pitch":35.977},{"time":39.683,"pitch":35.981},{"time":39.692,"pitch":35.985},{"time":39.700,"pitch":35.988},{"time":39.708,"pitch":35.991},{"time":39.717,"pitch":35.993},{"time":39.725,"pitch":35.994},{"time":39.733,"pitch":35.995},{"time":39.742,"pitch":35.996},{"time":39.750,"pitch":35.997},{"time":39.758,"pitch":35.998},{"time":39.775,"pitch":35.999},{"time":39.817,"pitch":36.000},{"time":40.000,"pitch":36.413},{"time":40.008,"pitch":36.740},{"time":40.017,"pitch":37.000},{"time":40.025,"pitch":37.206},{"time":40.033,"pitch":37.370},{"time":40.042,"pitch":37.500},{"time":40.050,"pitch":37.603},{"time":40.058,"pitch":37.685},{"time":40.067,"pitch":37.750},{"time":40.075,"pitch":37.802},{"time":40.083,"pitch":37.843},{"time":40.092,"pitch":37.875},{"time":40.100,"pitch":37.901},{"time":40.108,"pitch":37.921},{"time":40.117,"pitch":37.937},{"time":40.125,"pitch":37.950},{"time":40.133,"pitch":37.961},{"time":40.142,"pitch":37.969},{"time":40.150,"pitch":37.975},{"time":40.158,"pitch":37.980},{"time":40.167,"pitch":37.984},{"time":40.175,"pitch":37.988},{"time":40.183,"pitch":37.990},{"time":40.192,"pitch":37.992},{"time":40.200,"pitch":37.994},{"time":40.208,"pitch":37.995},{"time":40.217,"pitch":37.996},{"time":40.225,"pitch":37.997},{"time":40.233,"pitch":37.998},{"time":40.258,"pitch":37.999},{"time":40.292,"pitch":38.000},{"time":40.733,"pitch":38.619},{"time":40.742,"pitch":39.110},{"time":40.750,"pitch":39.500},{"time":40.758,"pitch":39.809},{"time":40.767,"pitch":40.055},{"time":40.775,"pitch":40.250},{"time":40.783,"pitch":40.405},{"time":40.792,"pitch":40.528},{"time":40.800,"pitch":40.625},{"time":40.808,"pitch":40.702},{"time":40.817,"pitch":40.764},{"time":40.825,"pitch":40.812},{"time":40.833,"pitch":40.851},{"time":40.842,"pitch":40.882},{"time":40.850,"pitch":40.906},{"time":40.858,"pitch":40.926},{"time":40.867,"pitch":40.941},{"time":40.875,"pitch":40.953},{"time":40.883,"pitch":40.963},{"time":40.892,"pitch":40.970},{"time":40.900,"pitch":40.977},{"time":40.908,"pitch":40.981},{"time":40.917,"pitch":40.985},{"time":40.925,"pitch":40.988},{"time":40.933,"pitch":40.991},{"time":40.942,"pitch":40.993},{"time":40.950,"pitch":40.994},{"time":40.958,"pitch":40.995},{"time":40.967,"pitch":40.996},{"time":40.975,"pitch":40.997},{"time":40.983,"pitch":40.998},{"time":41.000,"pitch":40.999},{"time":41.042,"pitch":41.000},{"time":41.258,"pitch":40.381},{"time":41.267,"pitch":39.890},{"time":41.275,"pitch":39.500},{"time":41.283,"pitch":39.191},{"time":41.292,"pitch":38.945},{"time":41.300,"pitch":38.750},{"time":41.308,"pitch":38.595},{"time":41.317,"pitch":38.472},{"time":41.325,"pitch":38.375},{"time":41.333,"pitch":38.298},{"time":41.342,"pitch":38.236},{"time":41.350,"pitch":38.187},{"time":41.358,"pitch":38.149},{"time":41.367,"pitch":38.118},{"time":41.375,"pitch":38.094},{"time":41.383,"pitch":38.074},{"time":41.392,"pitch":38.059},{"time":41.400,"pitch":38.047},{"time":41.408,"pitch":38.037},{"time":41.417,"pitch":38.030},{"time":41.425,"pitch":38.023},{"time":41.433,"pitch":38.019},{"time":41.442,"pitch":38.015},{"time":41.450,"pitch":38.012},{"time":41.458,"pitch":38.009},{"time":41.467,"pitch":38.007},{"time":41.475,"pitch":38.006},{"time":41.483,"pitch":38.005},{"time":41.492,"pitch":38.004},{"time":41.500,"pitch":38.622},{"time":41.508,"pitch":39.112},{"time":41.517,"pitch":39.502},{"time":41.525,"pitch":39.811},{"time":41.533,"pitch":40.056},{"time":41.542,"pitch":40.251},{"time":41.550,"pitch":40.405},{"time":41.558,"pitch":40.528},{"time":41.567,"pitch":40.625},{"time":41.575,"pitch":40.703},{"time":41.583,"pitch":40.764},{"time":41.592,"pitch":40.813},{"time":41.600,"pitch":40.851},{"time":41.608,"pitch":40.882},{"time":41.617,"pitch":40.906},{"time":41.625,"pitch":40.926},{"time":41.633,"pitch":40.941},{"time":41.642,"pitch":40.953},{"time":41.650,"pitch":40.963},{"time":41.658,"pitch":40.971},{"time":41.667,"pitch":40.977},{"time":41.675,"pitch":40.981},{"time":41.683,"pitch":40.985},{"time":41.692,"pitch":40.988},{"time":41.700,"pitch":40.991},{"time":41.708,"pitch":40.993},{"time":41.717,"pitch":40.994},{"time":41.725,"pitch":40.995},{"time":41.733,"pitch":40.996},{"time":41.742,"pitch":40.997},{"time":41.750,"pitch":40.998},{"time":41.767,"pitch":40.999},{"time":41.808,"pitch":41.000},{"time":42.008,"pitch":40.381},{"time":42.017,"pitch":39.890},{"time":42.025,"pitch":39.500},{"time":42.033,"pitch":39.191},{"time":42.042,"pitch":38.945},{"time":42.050,"pitch":38.750},{"time":42.058,"pitch":38.595},{"time":42.067,"pitch":38.472},{"time":42.075,"pitch":38.375},{"time":42.083,"pitch":38.298},{"time":42.092,"pitch":38.236},{"time":42.100,"pitch":38.187},{"time":42.108,"pitch":38.149},{"time":42.117,"pitch":38.118},{"time":42.125,"pitch":38.094},{"time":42.133,"pitch":38.074},{"time":42.142,"pitch":38.059},{"time":42.150,"pitch":38.047},{"time":42.158,"pitch":38.037},{"time":42.167,"pitch":38.030},{"time":42.175,"pitch":38.023},{"time":42.183,"pitch":38.019},{"time":42.192,"pitch":38.015},{"time":42.200,"pitch":38.012},{"time":42.208,"pitch":38.009},{"time":42.217,"pitch":38.007},{"time":42.225,"pitch":38.006},{"time":42.233,"pitch":38.005},{"time":42.242,"pitch":38.004},{"time":42.250,"pitch":38.003},{"time":42.258,"pitch":38.002},{"time":42.275,"pitch":38.001},{"time":42.317,"pitch":38.000},{"time":42.758,"pitch":37.587},{"time":42.767,"pitch":37.260},{"time":42.775,"pitch":37.000},{"time":42.783,"pitch":36.794},{"time":42.792,"pitch":36.630},{"time":42.800,"pitch":36.500},{"time":42.808,"pitch":36.397},{"time":42.817,"pitch":36.315},{"time":42.825,"pitch":36.250},{"time":42.833,"pitch":36.198},{"time":42.842,"pitch":36.157},{"time":42.850,"pitch":36.125},{"time":42.858,"pitch":36.099},{"time":42.867,"pitch":36.079},{"time":42.875,"pitch":36.063},{"time":42.883,"pitch":36.050},{"time":42.892,"pitch":36.039},{"time":42.900,"pitch":36.031},{"time":42.908,"pitch":36.025},{"time":42.917,"pitch":36.020},{"time":42.925,"pitch":36.016},{"time":42.933,"pitch":36.012},{"time":42.942,"pitch":36.010},{"time":42.950,"pitch":36.008},{"time":42.958,"pitch":36.006},{"time":42.967,"pitch":36.005},{"time":42.975,"pitch":36.004},{"time":42.983,"pitch":36.003},{"time":42.992,"pitch":36.002},{"time":43.017,"pitch":36.001},{"time":43.050,"pitch":36.000},{"time":43.258,"pitch":35.381},{"time":43.267,"pitch":34.890},{"time":43.275,"pitch":34.500},{"time":43.283,"pitch":34.191},{"time":43.292,"pitch":33.945},{"time":43.300,"pitch":33.750},{"time":43.308,"pitch":33.595},{"time":43.317,"pitch":33.472},{"time":43.325,"pitch":33.375},{"time":43.333,"pitch":33.298},{"time":43.342,"pitch":33.236},{"time":43.350,"pitch":33.188},{"time":43.358,"pitch":33.149},{"time":43.367,"pitch":33.118},{"time":43.375,"pitch":33.094},{"time":43.383,"pitch":33.074},{"time":43.392,"pitch":33.059},{"time":43.400,"pitch":33.047},{"time":43.408,"pitch":33.037},{"time":43.417,"pitch":33.030},{"time":43.425,"pitch":33.023},{"time":43.433,"pitch":33.019},{"time":43.442,"pitch":33.015},{"time":43.450,"pitch":33.012},{"time":43.458,"pitch":33.009},{"time":43.467,"pitch":33.007},{"time":43.475,"pitch":33.006},{"time":43.483,"pitch":33.005},{"time":43.492,"pitch":33.004},{"time":43.500,"pitch":33.003},{"time":43.508,"pitch":33.621},{"time":43.517,"pitch":34.112},{"time":43.525,"pitch":34.501},{"time":43.533,"pitch":34.811},{"time":43.542,"pitch":35.056},{"time":43.550,"pitch":35.251},{"time":43.558,"pitch":35.405},{"time":43.567,"pitch":35.528},{"time":43.575,"pitch":35.625},{"time":43.583,"pitch":35.703},{"time":43.592,"pitch":35.764},{"time":43.600,"pitch":35.813},{"time":43.608,"pitch":35.851},{"time":43.617,"pitch":35.882},{"time":43.625,"pitch":35.906},{"time":43.633,"pitch":35.926},{"time":43.642,"pitch":35.941},{"time":43.650,"pitch":35.953},{"time":43.658,"pitch":35.963},{"time":43.667,"pitch":35.970},{"time":43.675,"pitch":35.977},{"time":43.683,"pitch":35.981},{"time":43.692,"pitch":35.985},{"time":43.700,"pitch":35.988},{"time":43.708,"pitch":35.991},{"time":43.717,"pitch":35.993},{"time":43.725,"pitch":35.994},{"time":43.733,"pitch":35.995},{"time":43.742,"pitch":35.996},{"time":43.750,"pitch":35.997},{"time":43.758,"pitch":35.998},{"time":43.775,"pitch":35.999},{"time":43.817,"pitch":36.000},{"time":44.000,"pitch":36.413},{"time":44.008,"pitch":36.740},{"time":44.017,"pitch":37.000},{"time":44.025,"pitch":37.206},{"time":44.033,"pitch":37.370},{"time":44.042,"pitch":37.500},{"time":44.050,"pitch":37.603},{"time":44.058,"pitch":37.685},{"time":44.067,"pitch":37.750},{"time":44.075,"pitch":37.802},{"time":44.083,"pitch":37.843},{"time":44.092,"pitch":37.875},{"time":44.100,"pitch":37.901},{"time":44.108,"pitch":37.921},{"time":44.117,"pitch":37.937},{"time":44.125,"pitch":37.950},{"time":44.133,"pitch":37.961},{"time":44.142,"pitch":37.969},{"time":44.150,"pitch":37.975},{"time":44.158,"pitch":37.980},{"time":44.167,"pitch":37.984},{"time":44.175,"pitch":37.988},{"time":44.183,"pitch":37.990},{"time":44.192,"pitch":37.992},{"time":44.200,"pitch":37.994},{"time":44.208,"pitch":37.995},{"time":44.217,"pitch":37.996},{"time":44.225,"pitch":37.997},{"time":44.233,"pitch":37.998},{"time":44.258,"pitch":37.999},{"time":44.292,"pitch":38.000},{"time":44.733,"pitch":38.619},{"time":44.742,"pitch":39.110},{"time":44.750,"pitch":39.500},{"time":44.758,"pitch":39.809},{"time":44.767,"pitch":40.055},{"time":44.775,"pitch":40.250},{"time":44.783,"pitch":40.405},{"time":44.792,"pitch":40.528},{"time":44.800,"pitch":40.625},{"time":44.808,"pitch":40.702},{"time":44.817,"pitch":40.764},{"time":44.825,"pitch":40.812},{"time":44.833,"pitch":40.851},{"time":44.842,"pitch":40.882},{"time":44.850,"pitch":40.906},{"time":44.858,"pitch":40.926},{"time":44.867,"pitch":40.941},{"time":44.875,"pitch":40.953},{"time":44.883,"pitch":40.963},{"time":44.892,"pitch":40.970},{"time":44.900,"pitch":40.977},{"time":44.908,"pitch":40.981},{"time":44.917,"pitch":40.985},{"time":44.925,"pitch":40.988},{"time":44.933,"pitch":40.991},{"time":44.942,"pitch":40.993},{"time":44.950,"pitch":40.994},{"time":44.958,"pitch":40.995},{"time":44.967,"pitch":40.996},{"time":44.975,"pitch":40.997},{"time":44.983,"pitch":40.998},{"time":45.000,"pitch":40.999},{"time":45.042,"pitch":41.000},{"time":45.225,"pitch":41.619},{"time":45.233,"pitch":42.110},{"time":45.242,"pitch":42.500},{"time":45.250,"pitch":42.809},{"time":45.258,"pitch":43.055},{"time":45.267,"pitch":43.250},{"time":45.275,"pitch":43.405},{"time":45.283,"pitch":43.528},{"time":45.292,"pitch":43.625},{"time":45.300,"pitch":43.702},{"time":45.308,"pitch":43.764},{"time":45.317,"pitch":43.812},{"time":45.325,"pitch":43.851},{"time":45.333,"pitch":43.882},{"time":45.342,"pitch":43.906},{"time":45.350,"pitch":43.926},{"time":45.358,"pitch":43.941},{"time":45.367,"pitch":43.953},{"time":45.375,"pitch":43.963},{"time":45.383,"pitch":43.970},{"time":45.392,"pitch":43.977},{"time":45.400,"pitch":43.981},{"time":45.408,"pitch":43.985},{"time":45.417,"pitch":43.988},{"time":45.425,"pitch":43.991},{"time":45.433,"pitch":43.993},{"time":45.442,"pitch":43.994},{"time":45.450,"pitch":43.995},{"time":45.458,"pitch":43.996},{"time":45.467,"pitch":43.997},{"time":45.475,"pitch":43.998},{"time":45.492,"pitch":43.999},{"time":45.525,"pitch":43.793},{"time":45.533,"pitch":43.629},{"time":45.542,"pitch":43.500},{"time":45.550,"pitch":43.397},{"time":45.558,"pitch":43.315},{"time":45.567,"pitch":43.250},{"time":45.575,"pitch":43.198},{"time":45.583,"pitch":43.157},{"time":45.592,"pitch":43.125},{"time":45.600,"pitch":43.099},{"time":45.608,"pitch":43.079},{"time":45.617,"pitch":43.062},{"time":45.625,"pitch":43.050},{"time":45.633,"pitch":43.039},{"time":45.642,"pitch":43.031},{"time":45.650,"pitch":43.025},{"time":45.658,"pitch":43.020},{"time":45.667,"pitch":43.016},{"time":45.675,"pitch":43.012},{"time":45.683,"pitch":43.010},{"time":45.692,"pitch":43.008},{"time":45.700,"pitch":43.006},{"time":45.708,"pitch":43.005},{"time":45.717,"pitch":43.004},{"time":45.725,"pitch":43.003},{"time":45.733,"pitch":43.002},{"time":45.758,"pitch":43.001},{"time":45.792,"pitch":43.000},{"time":46.000,"pitch":42.587},{"time":46.008,"pitch":42.260},{"time":46.017,"pitch":42.000},{"time":46.025,"pitch":41.794},{"time":46.033,"pitch":41.630},{"time":46.042,"pitch":41.500},{"time":46.050,"pitch":41.397},{"time":46.058,"pitch":41.315},{"time":46.067,"pitch":41.250},{"time":46.075,"pitch":41.198},{"time":46.083,"pitch":41.157},{"time":46.092,"pitch":41.125},{"time":46.100,"pitch":41.099},{"time":46.108,"pitch":41.079},{"time":46.117,"pitch":41.063},{"time":46.125,"pitch":41.050},{"time":46.133,"pitch":41.039},{"time":46.142,"pitch":41.031},{"time":46.150,"pitch":41.025},{"time":46.158,"pitch":41.020},{"time":46.167,"pitch":41.016},{"time":46.175,"pitch":41.012},{"time":46.183,"pitch":41.010},{"time":46.192,"pitch":41.008},{"time":46.200,"pitch":41.006},{"time":46.208,"pitch":41.005},{"time":46.217,"pitch":41.004},{"time":46.225,"pitch":41.003},{"time":46.233,"pitch":41.002},{"time":46.258,"pitch":41.001},{"time":46.292,"pitch":41.000},{"time":46.758,"pitch":40.381},{"time":46.767,"pitch":39.890},{"time":46.775,"pitch":39.500},{"time":46.783,"pitch":39.191},{"time":46.792,"pitch":38.945},{"time":46.800,"pitch":38.750},{"time":46.808,"pitch":38.595},{"time":46.817,"pitch":38.472},{"time":46.825,"pitch":38.375},{"time":46.833,"pitch":38.298},{"time":46.842,"pitch":38.236},{"time":46.850,"pitch":38.188},{"time":46.858,"pitch":38.149},{"time":46.867,"pitch":38.118},{"time":46.875,"pitch":38.094},{"time":46.883,"pitch":38.074},{"time":46.892,"pitch":38.059},{"time":46.900,"pitch":38.047},{"time":46.908,"pitch":38.037},{"time":46.917,"pitch":38.030},{"time":46.925,"pitch":38.023},{"time":46.933,"pitch":38.019},{"time":46.942,"pitch":38.015},{"time":46.950,"pitch":38.012},{"time":46.958,"pitch":38.009},{"time":46.967,"pitch":38.007},{"time":46.975,"pitch":38.006},{"time":46.983,"pitch":38.005},{"time":46.992,"pitch":38.004},{"time":47.000,"pitch":38.003},{"time":47.008,"pitch":38.002},{"time":47.025,"pitch":38.001},{"time":47.067,"pitch":38.000},{"time":47.208,"pitch":36.969},{"time":47.217,"pitch":36.150},{"time":47.225,"pitch":35.500},{"time":47.233,"pitch":34.984},{"time":47.242,"pitch":34.575},{"time":47.250,"pitch":34.250},{"time":47.258,"pitch":33.992},{"time":47.267,"pitch":33.787},{"time":47.275,"pitch":33.625},{"time":47.283,"pitch":33.496},{"time":47.292,"pitch":33.394},{"time":47.300,"pitch":33.313},{"time":47.308,"pitch":33.248},{"time":47.317,"pitch":33.197},{"time":47.325,"pitch":33.156},{"time":47.333,"pitch":33.124},{"time":47.342,"pitch":33.098},{"time":47.350,"pitch":33.078},{"time":47.358,"pitch":33.062},{"time":47.367,"pitch":33.049},{"time":47.375,"pitch":33.039},{"time":47.383,"pitch":33.031},{"time":47.392,"pitch":33.025},{"time":47.400,"pitch":33.020},{"time":47.408,"pitch":33.016},{"time":47.417,"pitch":33.012},{"time":47.425,"pitch":33.010},{"time":47.433,"pitch":33.008},{"time":47.442,"pitch":33.006},{"time":47.450,"pitch":33.005},{"time":47.458,"pitch":33.004},{"time":47.467,"pitch":33.003},{"time":47.475,"pitch":33.002},{"time":47.500,"pitch":33.001},{"time":47.508,"pitch":33.620},{"time":47.517,"pitch":34.111},{"time":47.525,"pitch":34.501},{"time":47.533,"pitch":34.810},{"time":47.542,"pitch":35.055},{"time":47.550,"pitch":35.250},{"time":47.558,"pitch":35.405},{"time":47.567,"pitch":35.528},{"time":47.575,"pitch":35.625},{"time":47.583,"pitch":35.702},{"time":47.592,"pitch":35.764},{"time":47.600,"pitch":35.813},{"time":47.608,"pitch":35.851},{"time":47.617,"pitch":35.882},{"time":47.625,"pitch":35.906},{"time":47.633,"pitch":35.926},{"time":47.642,"pitch":35.941},{"time":47.650,"pitch":35.953},{"time":47.658,"pitch":35.963},{"time":47.667,"pitch":35.970},{"time":47.675,"pitch":35.977},{"time":47.683,"pitch":35.981},{"time":47.692,"pitch":35.985},{"time":47.700,"pitch":35.988},{"time":47.708,"pitch":35.991},{"time":47.717,"pitch":35.993},{"time":47.725,"pitch":35.994},{"time":47.733,"pitch":35.995},{"time":47.742,"pitch":35.996},{"time":47.750,"pitch":35.997},{"time":47.758,"pitch":35.998},{"time":47.775,"pitch":35.999},{"time":47.817,"pitch":36.000},{"time":48.000,"pitch":36.413},{"time":48.008,"pitch":36.740},{"time":48.017,"pitch":37.000},{"time":48.025,"pitch":37.206},{"time":48.033,"pitch":37.370},{"time":48.042,"pitch":37.500},{"time":48.050,"pitch":37.603},{"time":48.058,"pitch":37.685},{"time":48.067,"pitch":37.750},{"time":48.075,"pitch":37.802},{"time":48.083,"pitch":37.843},{"time":48.092,"pitch":37.875},{"time":48.100,"pitch":37.901},{"time":48.108,"pitch":37.921},{"time":48.117,"pitch":37.937},{"time":48.125,"pitch":37.950},{"time":48.133,"pitch":37.961},{"time":48.142,"pitch":37.969},{"time":48.150,"pitch":37.975},{"time":48.158,"pitch":37.980},{"time":48.167,"pitch":37.984},{"time":48.175,"pitch":37.988},{"time":48.183,"pitch":37.990},{"time":48.192,"pitch":37.992},{"time":48.200,"pitch":37.994},{"time":48.208,"pitch":37.995},{"time":48.217,"pitch":37.996},{"time":48.225,"pitch":37.997},{"time":48.233,"pitch":37.998},{"time":48.258,"pitch":37.999},{"time":48.292,"pitch":38.000},{"time":48.733,"pitch":38.619},{"time":48.742,"pitch":39.110},{"time":48.750,"pitch":39.500},{"time":48.758,"pitch":39.809},{"time":48.767,"pitch":40.055},{"time":48.775,"pitch":40.250},{"time":48.783,"pitch":40.405},{"time":48.792,"pitch":40.528},{"time":48.800,"pitch":40.625},{"time":48.808,"pitch":40.702},{"time":48.817,"pitch":40.764},{"time":48.825,"pitch":40.812},{"time":48.833,"pitch":40.851},{"time":48.842,"pitch":40.882},{"time":48.850,"pitch":40.906},{"time":48.858,"pitch":40.926},{"time":48.867,"pitch":40.941},{"time":48.875,"pitch":40.953},{"time":48.883,"pitch":40.963},{"time":48.892,"pitch":40.970},{"time":48.900,"pitch":40.977},{"time":48.908,"pitch":40.981},{"time":48.917,"pitch":40.985},{"time":48.925,"pitch":40.988},{"time":48.933,"pitch":40.991},{"time":48.942,"pitch":40.993},{"time":48.950,"pitch":40.994},{"time":48.958,"pitch":40.995},{"time":48.967,"pitch":40.996},{"time":48.975,"pitch":40.997},{"time":48.983,"pitch":40.998},{"time":49.000,"pitch":40.999},{"time":49.042,"pitch":41.000},{"time":49.258,"pitch":40.381},{"time":49.267,"pitch":39.890},{"time":49.275,"pitch":39.500},{"time":49.283,"pitch":39.191},{"time":49.292,"pitch":38.945},{"time":49.300,"pitch":38.750},{"time":49.308,"pitch":38.595},{"time":49.317,"pitch":38.472},{"time":49.325,"pitch":38.375},{"time":49.333,"pitch":38.298},{"time":49.342,"pitch":38.236},{"time":49.350,"pitch":38.187},{"time":49.358,"pitch":38.149},{"time":49.367,"pitch":38.118},{"time":49.375,"pitch":38.094},{"time":49.383,"pitch":38.074},{"time":49.392,"pitch":38.059},{"time":49.400,"pitch":38.047},{"time":49.408,"pitch":38.037},{"time":49.417,"pitch":38.030},{"time":49.425,"pitch":38.023},{"time":49.433,"pitch":38.019},{"time":49.442,"pitch":38.015},{"time":49.450,"pitch":38.012},{"time":49.458,"pitch":38.009},{"time":49.467,"pitch":38.007},{"time":49.475,"pitch":38.006},{"time":49.483,"pitch":38.005},{"time":49.492,"pitch":38.004},{"time":49.500,"pitch":38.622},{"time":49.508,"pitch":39.112},{"time":49.517,"pitch":39.502},{"time":49.525,"pitch":39.811},{"time":49.533,"pitch":40.056},{"time":49.542,"pitch":40.251},{"time":49.550,"pitch":40.405},{"time":49.558,"pitch":40.528},{"time":49.567,"pitch":40.625},{"time":49.575,"pitch":40.703},{"time":49.583,"pitch":40.764},{"time":49.592,"pitch":40.813},{"time":49.600,"pitch":40.851},{"time":49.608,"pitch":40.882},{"time":49.617,"pitch":40.906},{"time":49.625,"pitch":40.926},{"time":49.633,"pitch":40.941},{"time":49.642,"pitch":40.953},{"time":49.650,"pitch":40.963},{"time":49.658,"pitch":40.971},{"time":49.667,"pitch":40.977},{"time":49.675,"pitch":40.981},{"time":49.683,"pitch":40.985},{"time":49.692,"pitch":40.988},{"time":49.700,"pitch":40.991},{"time":49.708,"pitch":40.993},{"time":49.717,"pitch":40.994},{"time":49.725,"pitch":40.995},{"time":49.733,"pitch":40.996},{"time":49.742,"pitch":40.997},{"time":49.750,"pitch":40.998},{"time":49.767,"pitch":40.999},{"time":49.808,"pitch":41.000},{"time":50.008,"pitch":40.381},{"time":50.017,"pitch":39.890},{"time":50.025,"pitch":39.500},{"time":50.033,"pitch":39.191},{"time":50.042,"pitch":38.945},{"time":50.050,"pitch":38.750},{"time":50.058,"pitch":38.595},{"time":50.067,"pitch":38.472},{"time":50.075,"pitch":38.375},{"time":50.083,"pitch":38.298},{"time":50.092,"pitch":38.236},{"time":50.100,"pitch":38.187},{"time":50.108,"pitch":38.149},{"time":50.117,"pitch":38.118},{"time":50.125,"pitch":38.094},{"time":50.133,"pitch":38.074},{"time":50.142,"pitch":38.059},{"time":50.150,"pitch":38.047},{"time":50.158,"pitch":38.037},{"time":50.167,"pitch":38.030},{"time":50.175,"pitch":38.023},{"time":50.183,"pitch":38.019},{"time":50.192,"pitch":38.015},{"time":50.200,"pitch":38.012},{"time":50.208,"pitch":38.009},{"time":50.217,"pitch":38.007},{"time":50.225,"pitch":38.006},{"time":50.233,"pitch":38.005},{"time":50.242,"pitch":38.004},{"time":50.250,"pitch":38.003},{"time":50.258,"pitch":38.002},{"time":50.275,"pitch":38.001},{"time":50.317,"pitch":38.000},{"time":50.758,"pitch":37.587},{"time":50.767,"pitch":37.260},{"time":50.775,"pitch":37.000},{"time":50.783,"pitch":36.794},{"time":50.792,"pitch":36.630},{"time":50.800,"pitch":36.500},{"time":50.808,"pitch":36.397},{"time":50.817,"pitch":36.315},{"time":50.825,"pitch":36.250},{"time":50.833,"pitch":36.198},{"time":50.842,"pitch":36.157},{"time":50.850,"pitch":36.125},{"time":50.858,"pitch":36.099},{"time":50.867,"pitch":36.079},{"time":50.875,"pitch":36.063},{"time":50.883,"pitch":36.050},{"time":50.892,"pitch":36.039},{"time":50.900,"pitch":36.031},{"time":50.908,"pitch":36.025},{"time":50.917,"pitch":36.020},{"time":50.925,"pitch":36.016},{"time":50.933,"pitch":36.012},{"time":50.942,"pitch":36.010},{"time":50.950,"pitch":36.008},{"time":50.958,"pitch":36.006},{"time":50.967,"pitch":36.005},{"time":50.975,"pitch":36.004},{"time":50.983,"pitch":36.003},{"time":50.992,"pitch":36.002},{"time":51.017,"pitch":36.001},{"time":51.050,"pitch":36.000},{"time":51.258,"pitch":35.381},{"time":51.267,"pitch":34.890},{"time":51.275,"pitch":34.500},{"time":51.283,"pitch":34.191},{"time":51.292,"pitch":33.945},{"time":51.300,"pitch":33.750},{"time":51.308,"pitch":33.595},{"time":51.317,"pitch":33.472},{"time":51.325,"pitch":33.375},{"time":51.333,"pitch":33.298},{"time":51.342,"pitch":33.236},{"time":51.350,"pitch":33.188},{"time":51.358,"pitch":33.149},{"time":51.367,"pitch":33.118},{"time":51.375,"pitch":33.094},{"time":51.383,"pitch":33.074},{"time":51.392,"pitch":33.059},{"time":51.400,"pitch":33.047},{"time":51.408,"pitch":33.037},{"time":51.417,"pitch":33.030},{"time":51.425,"pitch":33.023},{"time":51.433,"pitch":33.019},{"time":51.442,"pitch":33.015},{"time":51.450,"pitch":33.012},{"time":51.458,"pitch":33.009},{"time":51.467,"pitch":33.007},{"time":51.475,"pitch":33.006},{"time":51.483,"pitch":33.005},{"time":51.492,"pitch":33.004},{"time":51.500,"pitch":33.003},{"time":51.508,"pitch":33.621},{"time":51.517,"pitch":34.112},{"time":51.525,"pitch":34.501},{"time":51.533,"pitch":34.811},{"time":51.542,"pitch":35.056},{"time":51.550,"pitch":35.251},{"time":51.558,"pitch":35.405},{"time":51.567,"pitch":35.528},{"time":51.575,"pitch":35.625},{"time":51.583,"pitch":35.703},{"time":51.592,"pitch":35.764},{"time":51.600,"pitch":35.813},{"time":51.608,"pitch":35.851},{"time":51.617,"pitch":35.882},{"time":51.625,"pitch":35.906},{"time":51.633,"pitch":35.926},{"time":51.642,"pitch":35.941},{"time":51.650,"pitch":35.953},{"time":51.658,"pitch":35.963},{"time":51.667,"pitch":35.970},{"time":51.675,"pitch":35.977},{"time":51.683,"pitch":35.981},{"time":51.692,"pitch":35.985},{"time":51.700,"pitch":35.988},{"time":51.708,"pitch":35.991},{"time":51.717,"pitch":35.993},{"time":51.725,"pitch":35.994},{"time":51.733,"pitch":35.995},{"time":51.742,"pitch":35.996},{"time":51.750,"pitch":35.997},{"time":51.758,"pitch":35.998},{"time":51.775,"pitch":35.999},{"time":51.817,"pitch":36.000},{"time":52.000,"pitch":36.413},{"time":52.008,"pitch":36.740},{"time":52.017,"pitch":37.000},{"time":52.025,"pitch":37.206},{"time":52.033,"pitch":37.370},{"time":52.042,"pitch":37.500},{"time":52.050,"pitch":37.603},{"time":52.058,"pitch":37.685},{"time":52.067,"pitch":37.750},{"time":52.075,"pitch":37.802},{"time":52.083,"pitch":37.843},{"time":52.092,"pitch":37.875},{"time":52.100,"pitch":37.901},{"time":52.108,"pitch":37.921},{"time":52.117,"pitch":37.937},{"time":52.125,"pitch":37.950},{"time":52.133,"pitch":37.961},{"time":52.142,"pitch":37.969},{"time":52.150,"pitch":37.975},{"time":52.158,"pitch":37.980},{"time":52.167,"pitch":37.984},{"time":52.175,"pitch":37.988},{"time":52.183,"pitch":37.990},{"time":52.192,"pitch":37.992},{"time":52.200,"pitch":37.994},{"time":52.208,"pitch":37.995},{"time":52.217,"pitch":37.996},{"time":52.225,"pitch":37.997},{"time":52.233,"pitch":37.998},{"time":52.258,"pitch":37.999},{"time":52.292,"pitch":38.000},{"time":52.733,"pitch":38.619},{"time":52.742,"pitch":39.110},{"time":52.750,"pitch":39.500},{"time":52.758,"pitch":39.809},{"time":52.767,"pitch":40.055},{"time":52.775,"pitch":40.250},{"time":52.783,"pitch":40.405},{"time":52.792,"pitch":40.528},{"time":52.800,"pitch":40.625},{"time":52.808,"pitch":40.702},{"time":52.817,"pitch":40.764},{"time":52.825,"pitch":40.812},{"time":52.833,"pitch":40.851},{"time":52.842,"pitch":40.882},{"time":52.850,"pitch":40.906},{"time":52.858,"pitch":40.926},{"time":52.867,"pitch":40.941},{"time":52.875,"pitch":40.953},{"time":52.883,"pitch":40.963},{"time":52.892,"pitch":40.970},{"time":52.900,"pitch":40.977},{"time":52.908,"pitch":40.981},{"time":52.917,"pitch":40.985},{"time":52.925,"pitch":40.988},{"time":52.933,"pitch":40.991},{"time":52.942,"pitch":40.993},{"time":52.950,"pitch":40.994},{"time":52.958,"pitch":40.995},{"time":52.967,"pitch":40.996},{"time":52.975,"pitch":40.997},{"time":52.983,"pitch":40.998},{"time":53.000,"pitch":40.999},{"time":53.042,"pitch":41.000},{"time":53.225,"pitch":41.619},{"time":53.233,"pitch":42.110},{"time":53.242,"pitch":42.500},{"time":53.250,"pitch":42.809},{"time":53.258,"pitch":43.055},{"time":53.267,"pitch":43.250},{"time":53.275,"pitch":43.405},{"time":53.283,"pitch":43.528},{"time":53.292,"pitch":43.625},{"time":53.300,"pitch":43.702},{"time":53.308,"pitch":43.764},{"time":53.317,"pitch":43.812},{"time":53.325,"pitch":43.851},{"time":53.333,"pitch":43.882},{"time":53.342,"pitch":43.906},{"time":53.350,"pitch":43.926},{"time":53.358,"pitch":43.941},{"time":53.367,"pitch":43.953},{"time":53.375,"pitch":43.963},{"time":53.383,"pitch":43.970},{"time":53.392,"pitch":43.977},{"time":53.400,"pitch":43.981},{"time":53.408,"pitch":43.985},{"time":53.417,"pitch":43.988},{"time":53.425,"pitch":43.991},{"time":53.433,"pitch":43.993},{"time":53.442,"pitch":43.994},{"time":53.450,"pitch":43.995},{"time":53.458,"pitch":43.996},{"time":53.467,"pitch":43.997},{"time":53.475,"pitch":43.998},{"time":53.492,"pitch":43.999},{"time":53.525,"pitch":43.793},{"time":53.533,"pitch":43.629},{"time":53.542,"pitch":43.500},{"time":53.550,"pitch":43.397},{"time":53.558,"pitch":43.315},{"time":53.567,"pitch":43.250},{"time":53.575,"pitch":43.198},{"time":53.583,"pitch":43.157},{"time":53.592,"pitch":43.125},{"time":53.600,"pitch":43.099},{"time":53.608,"pitch":43.079},{"time":53.617,"pitch":43.062},{"time":53.625,"pitch":43.050},{"time":53.633,"pitch":43.039},{"time":53.642,"pitch":43.031},{"time":53.650,"pitch":43.025},{"time":53.658,"pitch":43.020},{"time":53.667,"pitch":43.016},{"time":53.675,"pitch":43.012},{"time":53.683,"pitch":43.010},{"time":53.692,"pitch":43.008},{"time":53.700,"pitch":43.006},{"time":53.708,"pitch":43.005},{"time":53.717,"pitch":43.004},{"time":53.725,"pitch":43.003},{"time":53.733,"pitch":43.002},{"time":53.758,"pitch":43.001},{"time":53.792,"pitch":43.000},{"time":54.000,"pitch":42.587},{"time":54.008,"pitch":42.260},{"time":54.017,"pitch":42.000},{"time":54.025,"pitch":41.794},{"time":54.033,"pitch":41.630},{"time":54.042,"pitch":41.500},{"time":54.050,"pitch":41.397},{"time":54.058,"pitch":41.315},{"time":54.067,"pitch":41.250},{"time":54.075,"pitch":41.198},{"time":54.083,"pitch":41.157},{"time":54.092,"pitch":41.125},{"time":54.100,"pitch":41.099},{"time":54.108,"pitch":41.079},{"time":54.117,"pitch":41.063},{"time":54.125,"pitch":41.050},{"time":54.133,"pitch":41.039},{"time":54.142,"pitch":41.031},{"time":54.150,"pitch":41.025},{"time":54.158,"pitch":41.020},{"time":54.167,"pitch":41.016},{"time":54.175,"pitch":41.012},{"time":54.183,"pitch":41.010},{"time":54.192,"pitch":41.008},{"time":54.200,"pitch":41.006},{"time":54.208,"pitch":41.005},{"time":54.217,"pitch":41.004},{"time":54.225,"pitch":41.003},{"time":54.233,"pitch":41.002},{"time":54.258,"pitch":41.001},{"time":54.292,"pitch":41.000},{"time":54.758,"pitch":40.381},{"time":54.767,"pitch":39.890},{"time":54.775,"pitch":39.500},{"time":54.783,"pitch":39.191},{"time":54.792,"pitch":38.945},{"time":54.800,"pitch":38.750},{"time":54.808,"pitch":38.595},{"time":54.817,"pitch":38.472},{"time":54.825,"pitch":38.375},{"time":54.833,"pitch":38.298},{"time":54.842,"pitch":38.236},{"time":54.850,"pitch":38.188},{"time":54.858,"pitch":38.149},{"time":54.867,"pitch":38.118},{"time":54.875,"pitch":38.094},{"time":54.883,"pitch":38.074},{"time":54.892,"pitch":38.059},{"time":54.900,"pitch":38.047},{"time":54.908,"pitch":38.037},{"time":54.917,"pitch":38.030},{"time":54.925,"pitch":38.023},{"time":54.933,"pitch":38.019},{"time":54.942,"pitch":38.015},{"time":54.950,"pitch":38.012},{"time":54.958,"pitch":38.009},{"time":54.967,"pitch":38.007},{"time":54.975,"pitch":38.006},{"time":54.983,"pitch":38.005},{"time":54.992,"pitch":38.004},{"time":55.000,"pitch":38.003},{"time":55.008,"pitch":38.002},{"time":55.025,"pitch":38.001},{"time":55.067,"pitch":38.000},{"time":55.208,"pitch":36.969},{"time":55.217,"pitch":36.150},{"time":55.225,"pitch":35.500},{"time":55.233,"pitch":34.984},{"time":55.242,"pitch":34.575},{"time":55.250,"pitch":34.250},{"time":55.258,"pitch":33.992},{"time":55.267,"pitch":33.787},{"time":55.275,"pitch":33.625},{"time":55.283,"pitch":33.496},{"time":55.292,"pitch":33.394},{"time":55.300,"pitch":33.313},{"time":55.308,"pitch":33.248},{"time":55.317,"pitch":33.197},{"time":55.325,"pitch":33.156},{"time":55.333,"pitch":33.124},{"time":55.342,"pitch":33.098},{"time":55.350,"pitch":33.078},{"time":55.358,"pitch":33.062},{"time":55.367,"pitch":33.049},{"time":55.375,"pitch":33.039},{"time":55.383,"pitch":33.031},{"time":55.392,"pitch":33.025},{"time":55.400,"pitch":33.020},{"time":55.408,"pitch":33.016},{"time":55.417,"pitch":33.012},{"time":55.425,"pitch":33.010},{"time":55.433,"pitch":33.008},{"time":55.442,"pitch":33.006},{"time":55.450,"pitch":33.005},{"time":55.458,"pitch":33.004},{"time":55.467,"pitch":33.003},{"time":55.475,"pitch":33.002},{"time":55.500,"pitch":33.001},{"time":55.508,"pitch":33.620},{"time":55.517,"pitch":34.111},{"time":55.525,"pitch":34.501},{"time":55.533,"pitch":34.810},{"time":55.542,"pitch":35.055},{"time":55.550,"pitch":35.250},{"time":55.558,"pitch":35.405},{"time":55.567,"pitch":35.528},{"time":55.575,"pitch":35.625},{"time":55.583,"pitch":35.702},{"time":55.592,"pitch":35.764},{"time":55.600,"pitch":35.813},{"time":55.608,"pitch":35.851},{"time":55.617,"pitch":35.882},{"time":55.625,"pitch":35.906},{"time":55.633,"pitch":35.926},{"time":55.642,"pitch":35.941},{"time":55.650,"pitch":35.953},{"time":55.658,"pitch":35.963},{"time":55.667,"pitch":35.970},{"time":55.675,"pitch":35.977},{"time":55.683,"pitch":35.981},{"time":55.692,"pitch":35.985},{"time":55.700,"pitch":35.988},{"time":55.708,"pitch":35.991},{"time":55.717,"pitch":35.993},{"time":55.725,"pitch":35.994},{"time":55.733,"pitch":35.995},{"time":55.742,"pitch":35.996},{"time":55.750,"pitch":35.997},{"time":55.758,"pitch":35.998},{"time":55.775,"pitch":35.999},{"time":55.817,"pitch":36.000},{"time":56.000,"pitch":36.413},{"time":56.008,"pitch":36.740},{"time":56.017,"pitch":37.000},{"time":56.025,"pitch":37.206},{"time":56.033,"pitch":37.370},{"time":56.042,"pitch":37.500},{"time":56.050,"pitch":37.603},{"time":56.058,"pitch":37.685},{"time":56.067,"pitch":37.750},{"time":56.075,"pitch":37.802},{"time":56.083,"pitch":37.843},{"time":56.092,"pitch":37.875},{"time":56.100,"pitch":37.901},{"time":56.108,"pitch":37.921},{"time":56.117,"pitch":37.937},{"time":56.125,"pitch":37.950},{"time":56.133,"pitch":37.961},{"time":56.142,"pitch":37.969},{"time":56.150,"pitch":37.975},{"time":56.158,"pitch":37.980},{"time":56.167,"pitch":37.984},{"time":56.175,"pitch":37.988},{"time":56.183,"pitch":37.990},{"time":56.192,"pitch":37.992},{"time":56.200,"pitch":37.994},{"time":56.208,"pitch":37.995},{"time":56.217,"pitch":37.996},{"time":56.225,"pitch":37.997},{"time":56.233,"pitch":37.998},{"time":56.258,"pitch":37.999},{"time":56.292,"pitch":38.000},{"time":56.733,"pitch":38.619},{"time":56.742,"pitch":39.110},{"time":56.750,"pitch":39.500},{"time":56.758,"pitch":39.809},{"time":56.767,"pitch":40.055},{"time":56.775,"pitch":40.250},{"time":56.783,"pitch":40.405},{"time":56.792,"pitch":40.528},{"time":56.800,"pitch":40.625},{"time":56.808,"pitch":40.702},{"time":56.817,"pitch":40.764},{"time":56.825,"pitch":40.812},{"time":56.833,"pitch":40.851},{"time":56.842,"pitch":40.882},{"time":56.850,"pitch":40.906},{"time":56.858,"pitch":40.926},{"time":56.867,"pitch":40.941},{"time":56.875,"pitch":40.953},{"time":56.883,"pitch":40.963},{"time":56.892,"pitch":40.970},{"time":56.900,"pitch":40.977},{"time":56.908,"pitch":40.981},{"time":56.917,"pitch":40.985},{"time":56.925,"pitch":40.988},{"time":56.933,"pitch":40.991},{"time":56.942,"pitch":40.993},{"time":56.950,"pitch":40.994},{"time":56.958,"pitch":40.995},{"time":56.967,"pitch":40.996},{"time":56.975,"pitch":40.997},{"time":56.983,"pitch":40.998},{"time":57.000,"pitch":40.999},{"time":57.042,"pitch":41.000},{"time":57.258,"pitch":40.381},{"time":57.267,"pitch":39.890},{"time":57.275,"pitch":39.500},{"time":57.283,"pitch":39.191},{"time":57.292,"pitch":38.945},{"time":57.300,"pitch":38.750},{"time":57.308,"pitch":38.595},{"time":57.317,"pitch":38.472},{"time":57.325,"pitch":38.375},{"time":57.333,"pitch":38.298},{"time":57.342,"pitch":38.236},{"time":57.350,"pitch":38.187},{"time":57.358,"pitch":38.149},{"time":57.367,"pitch":38.118},{"time":57.375,"pitch":38.094},{"time":57.383,"pitch":38.074},{"time":57.392,"pitch":38.059},{"time":57.400,"pitch":38.047},{"time":57.408,"pitch":38.037},{"time":57.417,"pitch":38.030},{"time":57.425,"pitch":38.023},{"time":57.433,"pitch":38.019},{"time":57.442,"pitch":38.015},{"time":57.450,"pitch":38.012},{"time":57.458,"pitch":38.009},{"time":57.467,"pitch":38.007},{"time":57.475,"pitch":38.006},{"time":57.483,"pitch":38.005},{"time":57.492,"pitch":38.004},{"time":57.500,"pitch":38.622},{"time":57.508,"pitch":39.112},{"time":57.517,"pitch":39.502},{"time":57.525,"pitch":39.811},{"time":57.533,"pitch":40.056},{"time":57.542,"pitch":40.251},{"time":57.550,"pitch":40.405},{"time":57.558,"pitch":40.528},{"time":57.567,"pitch":40.625},{"time":57.575,"pitch":40.703},{"time":57.583,"pitch":40.764},{"time":57.592,"pitch":40.813},{"time":57.600,"pitch":40.851},{"time":57.608,"pitch":40.882},{"time":57.617,"pitch":40.906},{"time":57.625,"pitch":40.926},{"time":57.633,"pitch":40.941},{"time":57.642,"pitch":40.953},{"time":57.650,"pitch":40.963},{"time":57.658,"pitch":40.971},{"time":57.667,"pitch":40.977},{"time":57.675,"pitch":40.981},{"time":57.683,"pitch":40.985},{"time":57.692,"pitch":40.988},{"time":57.700,"pitch":40.991},{"time":57.708,"pitch":40.993},{"time":57.717,"pitch":40.994},{"time":57.725,"pitch":40.995},{"time":57.733,"pitch":40.996},{"time":57.742,"pitch":40.997},{"time":57.750,"pitch":40.998},{"time":57.767,"pitch":40.999},{"time":57.808,"pitch":41.000},{"time":58.008,"pitch":40.381},{"time":58.017,"pitch":39.890},{"time":58.025,"pitch":39.500},{"time":58.033,"pitch":39.191},{"time":58.042,"pitch":38.945},{"time":58.050,"pitch":38.750},{"time":58.058,"pitch":38.595},{"time":58.067,"pitch":38.472},{"time":58.075,"pitch":38.375},{"time":58.083,"pitch":38.298},{"time":58.092,"pitch":38.236},{"time":58.100,"pitch":38.187},{"time":58.108,"pitch":38.149},{"time":58.117,"pitch":38.118},{"time":58.125,"pitch":38.094},{"time":58.133,"pitch":38.074},{"time":58.142,"pitch":38.059},{"time":58.150,"pitch":38.047},{"time":58.158,"pitch":38.037},{"time":58.167,"pitch":38.030},{"time":58.175,"pitch":38.023},{"time":58.183,"pitch":38.019},{"time":58.192,"pitch":38.015},{"time":58.200,"pitch":38.012},{"time":58.208,"pitch":38.009},{"time":58.217,"pitch":38.007},{"time":58.225,"pitch":38.006},{"time":58.233,"pitch":38.005},{"time":58.242,"pitch":38.004},{"time":58.250,"pitch":38.003},{"time":58.258,"pitch":38.002},{"time":58.275,"pitch":38.001},{"time":58.317,"pitch":38.000},{"time":58.758,"pitch":37.587},{"time":58.767,"pitch":37.260},{"time":58.775,"pitch":37.000},{"time":58.783,"pitch":36.794},{"time":58.792,"pitch":36.630},{"time":58.800,"pitch":36.500},{"time":58.808,"pitch":36.397},{"time":58.817,"pitch":36.315},{"time":58.825,"pitch":36.250},{"time":58.833,"pitch":36.198},{"time":58.842,"pitch":36.157},{"time":58.850,"pitch":36.125},{"time":58.858,"pitch":36.099},{"time":58.867,"pitch":36.079},{"time":58.875,"pitch":36.063},{"time":58.883,"pitch":36.050},{"time":58.892,"pitch":36.039},{"time":58.900,"pitch":36.031},{"time":58.908,"pitch":36.025},{"time":58.917,"pitch":36.020},{"time":58.925,"pitch":36.016},{"time":58.933,"pitch":36.012},{"time":58.942,"pitch":36.010},{"time":58.950,"pitch":36.008},{"time":58.958,"pitch":36.006},{"time":58.967,"pitch":36.005},{"time":58.975,"pitch":36.004},{"time":58.983,"pitch":36.003},{"time":58.992,"pitch":36.002},{"time":59.017,"pitch":36.001},{"time":59.050,"pitch":36.000},{"time":59.258,"pitch":35.381},{"time":59.267,"pitch":34.890},{"time":59.275,"pitch":34.500},{"time":59.283,"pitch":34.191},{"time":59.292,"pitch":33.945},{"time":59.300,"pitch":33.750},{"time":59.308,"pitch":33.595},{"time":59.317,"pitch":33.472},{"time":59.325,"pitch":33.375},{"time":59.333,"pitch":33.298},{"time":59.342,"pitch":33.236},{"time":59.350,"pitch":33.188},{"time":59.358,"pitch":33.149},{"time":59.367,"pitch":33.118},{"time":59.375,"pitch":33.094},{"time":59.383,"pitch":33.074},{"time":59.392,"pitch":33.059},{"time":59.400,"pitch":33.047},{"time":59.408,"pitch":33.037},{"time":59.417,"pitch":33.030},{"time":59.425,"pitch":33.023},{"time":59.433,"pitch":33.019},{"time":59.442,"pitch":33.015},{"time":59.450,"pitch":33.012},{"time":59.458,"pitch":33.009},{"time":59.467,"pitch":33.007},{"time":59.475,"pitch":33.006},{"time":59.483,"pitch":33.005},{"time":59.492,"pitch":33.004},{"time":59.500,"pitch":33.003},{"time":59.508,"pitch":33.621},{"time":59.517,"pitch":34.112},{"time":59.525,"pitch":34.501},{"time":59.533,"pitch":34.811},{"time":59.542,"pitch":35.056},{"time":59.550,"pitch":35.251},{"time":59.558,"pitch":35.405},{"time":59.567,"pitch":35.528},{"time":59.575,"pitch":35.625},{"time":59.583,"pitch":35.703},{"time":59.592,"pitch":35.764},{"time":59.600,"pitch":35.813},{"time":59.608,"pitch":35.851},{"time":59.617,"pitch":35.882},{"time":59.625,"pitch":35.906},{"time":59.633,"pitch":35.926},{"time":59.642,"pitch":35.941},{"time":59.650,"pitch":35.953},{"time":59.658,"pitch":35.963},{"time":59.667,"pitch":35.970},{"time":59.675,"pitch":35.977},{"time":59.683,"pitch":35.981},{"time":59.692,"pitch":35.985},{"time":59.700,"pitch":35.988},{"time":59.708,"pitch":35.991},{"time":59.717,"pitch":35.993},{"time":59.725,"pitch":35.994},{"time":59.733,"pitch":35.995},{"time":59.742,"pitch":35.996},{"time":59.750,"pitch":35.997},{"time":59.758,"pitch":35.998},{"time":59.775,"pitch":35.999},{"time":59.817,"pitch":36.000},{"time":60.000,"pitch":36.413},{"time":60.008,"pitch":36.740},{"time":60.017,"pitch":37.000},{"time":60.025,"pitch":37.206},{"time":60.033,"pitch":37.370},{"time":60.042,"pitch":37.500},{"time":60.050,"pitch":37.603},{"time":60.058,"pitch":37.685},{"time":60.067,"pitch":37.750},{"time":60.075,"pitch":37.802},{"time":60.083,"pitch":37.843},{"time":60.092,"pitch":37.875},{"time":60.100,"pitch":37.901},{"time":60.108,"pitch":37.921},{"time":60.117,"pitch":37.937},{"time":60.125,"pitch":37.950},{"time":60.133,"pitch":37.961},{"time":60.142,"pitch":37.969},{"time":60.150,"pitch":37.975},{"time":60.158,"pitch":37.980},{"time":60.167,"pitch":37.984},{"time":60.175,"pitch":37.988},{"time":60.183,"pitch":37.990},{"time":60.192,"pitch":37.992},{"time":60.200,"pitch":37.994},{"time":60.208,"pitch":37.995},{"time":60.217,"pitch":37.996},{"time":60.225,"pitch":37.997},{"time":60.233,"pitch":37.998},{"time":60.258,"pitch":37.999},{"time":60.292,"pitch":38.000},{"time":60.733,"pitch":38.619},{"time":60.742,"pitch":39.110},{"time":60.750,"pitch":39.500},{"time":60.758,"pitch":39.809},{"time":60.767,"pitch":40.055},{"time":60.775,"pitch":40.250},{"time":60.783,"pitch":40.405},{"time":60.792,"pitch":40.528},{"time":60.800,"pitch":40.625},{"time":60.808,"pitch":40.702},{"time":60.817,"pitch":40.764},{"time":60.825,"pitch":40.812},{"time":60.833,"pitch":40.851},{"time":60.842,"pitch":40.882},{"time":60.850,"pitch":40.906},{"time":60.858,"pitch":40.926},{"time":60.867,"pitch":40.941},{"time":60.875,"pitch":40.953},{"time":60.883,"pitch":40.963},{"time":60.892,"pitch":40.970},{"time":60.900,"pitch":40.977},{"time":60.908,"pitch":40.981},{"time":60.917,"pitch":40.985},{"time":60.925,"pitch":40.988},{"time":60.933,"pitch":40.991},{"time":60.942,"pitch":40.993},{"time":60.950,"pitch":40.994},{"time":60.958,"pitch":40.995},{"time":60.967,"pitch":40.996},{"time":60.975,"pitch":40.997},{"time":60.983,"pitch":40.998},{"time":61.000,"pitch":40.999},{"time":61.042,"pitch":41.000},{"time":61.225,"pitch":41.619},{"time":61.233,"pitch":42.110},{"time":61.242,"pitch":42.500},{"time":61.250,"pitch":42.809},{"time":61.258,"pitch":43.055},{"time":61.267,"pitch":43.250},{"time":61.275,"pitch":43.405},{"time":61.283,"pitch":43.528},{"time":61.292,"pitch":43.625},{"time":61.300,"pitch":43.702},{"time":61.308,"pitch":43.764},{"time":61.317,"pitch":43.812},{"time":61.325,"pitch":43.851},{"time":61.333,"pitch":43.882},{"time":61.342,"pitch":43.906},{"time":61.350,"pitch":43.926},{"time":61.358,"pitch":43.941},{"time":61.367,"pitch":43.953},{"time":61.375,"pitch":43.963},{"time":61.383,"pitch":43.970},{"time":61.392,"pitch":43.977},{"time":61.400,"pitch":43.981},{"time":61.408,"pitch":43.985},{"time":61.417,"pitch":43.988},{"time":61.425,"pitch":43.991},{"time":61.433,"pitch":43.993},{"time":61.442,"pitch":43.994},{"time":61.450,"pitch":43.995},{"time":61.458,"pitch":43.996},{"time":61.467,"pitch":43.997},{"time":61.475,"pitch":43.998},{"time":61.492,"pitch":43.999},{"time":61.525,"pitch":43.793},{"time":61.533,"pitch":43.629},{"time":61.542,"pitch":43.500},{"time":61.550,"pitch":43.397},{"time":61.558,"pitch":43.315},{"time":61.567,"pitch":43.250},{"time":61.575,"pitch":43.198},{"time":61.583,"pitch":43.157},{"time":61.592,"pitch":43.125},{"time":61.600,"pitch":43.099},{"time":61.608,"pitch":43.079},{"time":61.617,"pitch":43.062},{"time":61.625,"pitch":43.050},{"time":61.633,"pitch":43.039},{"time":61.642,"pitch":43.031},{"time":61.650,"pitch":43.025},{"time":61.658,"pitch":43.020},{"time":61.667,"pitch":43.016},{"time":61.675,"pitch":43.012},{"time":61.683,"pitch":43.010},{"time":61.692,"pitch":43.008},{"time":61.700,"pitch":43.006},{"time":61.708,"pitch":43.005},{"time":61.717,"pitch":43.004},{"time":61.725,"pitch":43.003},{"time":61.733,"pitch":43.002},{"time":61.758,"pitch":43.001},{"time":61.792,"pitch":43.000},{"time":62.000,"pitch":42.587},{"time":62.008,"pitch":42.260},{"time":62.017,"pitch":42.000},{"time":62.025,"pitch":41.794},{"time":62.033,"pitch":41.630},{"time":62.042,"pitch":41.500},{"time":62.050,"pitch":41.397},{"time":62.058,"pitch":41.315},{"time":62.067,"pitch":41.250},{"time":62.075,"pitch":41.198},{"time":62.083,"pitch":41.157},{"time":62.092,"pitch":41.125},{"time":62.100,"pitch":41.099},{"time":62.108,"pitch":41.079},{"time":62.117,"pitch":41.063},{"time":62.125,"pitch":41.050},{"time":62.133,"pitch":41.039},{"time":62.142,"pitch":41.031},{"time":62.150,"pitch":41.025},{"time":62.158,"pitch":41.020},{"time":62.167,"pitch":41.016},{"time":62.175,"pitch":41.012},{"time":62.183,"pitch":41.010},{"time":62.192,"pitch":41.008},{"time":62.200,"pitch":41.006},{"time":62.208,"pitch":41.005},{"time":62.217,"pitch":41.004},{"time":62.225,"pitch":41.003},{"time":62.233,"pitch":41.002},{"time":62.258,"pitch":41.001},{"time":62.292,"pitch":41.000},{"time":62.758,"pitch":40.381},{"time":62.767,"pitch":39.890},{"time":62.775,"pitch":39.500},{"time":62.783,"pitch":39.191},{"time":62.792,"pitch":38.945},{"time":62.800,"pitch":38.750},{"time":62.808,"pitch":38.595},{"time":62.817,"pitch":38.472},{"time":62.825,"pitch":38.375},{"time":62.833,"pitch":38.298},{"time":62.842,"pitch":38.236},{"time":62.850,"pitch":38.188},{"time":62.858,"pitch":38.149},{"time":62.867,"pitch":38.118},{"time":62.875,"pitch":38.094},{"time":62.883,"pitch":38.074},{"time":62.892,"pitch":38.059},{"time":62.900,"pitch":38.047},{"time":62.908,"pitch":38.037},{"time":62.917,"pitch":38.030},{"time":62.925,"pitch":38.023},{"time":62.933,"pitch":38.019},{"time":62.942,"pitch":38.015},{"time":62.950,"pitch":38.012},{"time":62.958,"pitch":38.009},{"time":62.967,"pitch":38.007},{"time":62.975,"pitch":38.006},{"time":62.983,"pitch":38.005},{"time":62.992,"pitch":38.004},{"time":63.000,"pitch":38.003},{"time":63.008,"pitch":38.002},{"time":63.025,"pitch":38.001},{"time":63.067,"pitch":38.000},{"time":63.208,"pitch":36.969},{"time":63.217,"pitch":36.150},{"time":63.225,"pitch":35.500},{"time":63.233,"pitch":34.984},{"time":63.242,"pitch":34.575},{"time":63.250,"pitch":34.250},{"time":63.258,"pitch":33.992},{"time":63.267,"pitch":33.787},{"time":63.275,"pitch":33.625},{"time":63.283,"pitch":33.496},{"time":63.292,"pitch":33.394},{"time":63.300,"pitch":33.313},{"time":63.308,"pitch":33.248},{"time":63.317,"pitch":33.197},{"time":63.325,"pitch":33.156},{"time":63.333,"pitch":33.124},{"time":63.342,"pitch":33.098},{"time":63.350,"pitch":33.078},{"time":63.358,"pitch":33.062},{"time":63.367,"pitch":33.049},{"time":63.375,"pitch":33.039},{"time":63.383,"pitch":33.031},{"time":63.392,"pitch":33.025},{"time":63.400,"pitch":33.020},{"time":63.408,"pitch":33.016},{"time":63.417,"pitch":33.012},{"time":63.425,"pitch":33.010},{"time":63.433,"pitch":33.008},{"time":63.442,"pitch":33.006},{"time":63.450,"pitch":33.005},{"time":63.458,"pitch":33.004},{"time":63.467,"pitch":33.003},{"time":63.475,"pitch":33.002},{"time":63.500,"pitch":33.001},{"time":63.508,"pitch":33.620},{"time":63.517,"pitch":34.111},{"time":63.525,"pitch":34.501},{"time":63.533,"pitch":34.810},{"time":63.542,"pitch":35.055},{"time":63.550,"pitch":35.250},{"time":63.558,"pitch":35.405},{"time":63.567,"pitch":35.528},{"time":63.575,"pitch":35.625},{"time":63.583,"pitch":35.702},{"time":63.592,"pitch":35.764},{"time":63.600,"pitch":35.813},{"time":63.608,"pitch":35.851},{"time":63.617,"pitch":35.882},{"time":63.625,"pitch":35.906},{"time":63.633,"pitch":35.926},{"time":63.642,"pitch":35.941},{"time":63.650,"pitch":35.953},{"time":63.658,"pitch":35.963},{"time":63.667,"pitch":35.970},{"time":63.675,"pitch":35.977},{"time":63.683,"pitch":35.981},{"time":63.692,"pitch":35.985},{"time":63.700,"pitch":35.988},{"time":63.708,"pitch":35.991},{"time":63.717,"pitch":35.993},{"time":63.725,"pitch":35.994},{"time":63.733,"pitch":35.995},{"time":63.742,"pitch":35.996},{"time":63.750,"pitch":35.997},{"time":63.758,"pitch":35.998},{"time":63.775,"pitch":35.999},{"time":63.817,"pitch":36.000},{"time":64.000,"pitch":36.413},{"time":64.008,"pitch":36.740},{"time":64.017,"pitch":37.000},{"time":64.025,"pitch":37.206},{"time":64.033,"pitch":37.370},{"time":64.042,"pitch":37.500},{"time":64.050,"pitch":37.603},{"time":64.058,"pitch":37.685},{"time":64.067,"pitch":37.750},{"time":64.075,"pitch":37.802},{"time":64.083,"pitch":37.843},{"time":64.092,"pitch":37.875},{"time":64.100,"pitch":37.901},{"time":64.108,"pitch":37.921},{"time":64.117,"pitch":37.937},{"time":64.125,"pitch":37.950},{"time":64.133,"pitch":37.961},{"time":64.142,"pitch":37.969},{"time":64.150,"pitch":37.975},{"time":64.158,"pitch":37.980},{"time":64.167,"pitch":37.984},{"time":64.175,"pitch":37.988},{"time":64.183,"pitch":37.990},{"time":64.192,"pitch":37.992},{"time":64.200,"pitch":37.994},{"time":64.208,"pitch":37.995},{"time":64.217,"pitch":37.996},{"time":64.225,"pitch":37.997},{"time":64.233,"pitch":37.998},{"time":64.258,"pitch":37.999},{"time":64.292,"pitch":38.000},{"time":64.317,"volume":0.833},{"time":64.325,"volume":0.667},{"time":64.333,"volume":0.500},{"time":64.342,"volume":0.333},{"time":64.350,"volume":0.167},{"time":64.358,"volume":0.000},{"time":64.367,"volume":0}]}}],"b0ba6f144fac4f668ba6981c691277d6":[{"instanceName":""},{"noteOn":{"time":55.000,"k":[{"time":0.000,"pitch":38.000,"volume":0.167},{"time":0.008,"pitch":38.000,"volume":0.333},{"time":0.017,"volume":0.500},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1.000},{"time":0.733,"pitch":38.619},{"time":0.742,"pitch":39.110},{"time":0.750,"pitch":39.500},{"time":0.758,"pitch":39.809},{"time":0.767,"pitch":40.055},{"time":0.775,"pitch":40.250},{"time":0.783,"pitch":40.405},{"time":0.792,"pitch":40.528},{"time":0.800,"pitch":40.625},{"time":0.808,"pitch":40.702},{"time":0.817,"pitch":40.764},{"time":0.825,"pitch":40.813},{"time":0.833,"pitch":40.851},{"time":0.842,"pitch":40.882},{"time":0.850,"pitch":40.906},{"time":0.858,"pitch":40.926},{"time":0.867,"pitch":40.941},{"time":0.875,"pitch":40.953},{"time":0.883,"pitch":40.963},{"time":0.892,"pitch":40.970},{"time":0.900,"pitch":40.977},{"time":0.908,"pitch":40.981},{"time":0.917,"pitch":40.985},{"time":0.925,"pitch":40.988},{"time":0.933,"pitch":40.991},{"time":0.942,"pitch":40.993},{"time":0.950,"pitch":40.994},{"time":0.958,"pitch":40.995},{"time":0.967,"pitch":40.996},{"time":0.975,"pitch":40.997},{"time":0.983,"pitch":40.998},{"time":1.000,"pitch":40.999},{"time":1.042,"pitch":41.000},{"time":1.258,"pitch":40.381},{"time":1.267,"pitch":39.890},{"time":1.275,"pitch":39.500},{"time":1.283,"pitch":39.191},{"time":1.292,"pitch":38.945},{"time":1.300,"pitch":38.750},{"time":1.308,"pitch":38.595},{"time":1.317,"pitch":38.472},{"time":1.325,"pitch":38.375},{"time":1.333,"pitch":38.298},{"time":1.342,"pitch":38.236},{"time":1.350,"pitch":38.187},{"time":1.358,"pitch":38.149},{"time":1.367,"pitch":38.118},{"time":1.375,"pitch":38.094},{"time":1.383,"pitch":38.074},{"time":1.392,"pitch":38.059},{"time":1.400,"pitch":38.047},{"time":1.408,"pitch":38.037},{"time":1.417,"pitch":38.030},{"time":1.425,"pitch":38.023},{"time":1.433,"pitch":38.019},{"time":1.442,"pitch":38.015},{"time":1.450,"pitch":38.012},{"time":1.458,"pitch":38.009},{"time":1.467,"pitch":38.007},{"time":1.475,"pitch":38.006},{"time":1.483,"pitch":38.005},{"time":1.492,"pitch":38.004},{"time":1.500,"pitch":38.622},{"time":1.508,"pitch":39.112},{"time":1.517,"pitch":39.502},{"time":1.525,"pitch":39.811},{"time":1.533,"pitch":40.056},{"time":1.542,"pitch":40.251},{"time":1.550,"pitch":40.405},{"time":1.558,"pitch":40.528},{"time":1.567,"pitch":40.625},{"time":1.575,"pitch":40.703},{"time":1.583,"pitch":40.764},{"time":1.592,"pitch":40.813},{"time":1.600,"pitch":40.851},{"time":1.608,"pitch":40.882},{"time":1.617,"pitch":40.906},{"time":1.625,"pitch":40.926},{"time":1.633,"pitch":40.941},{"time":1.642,"pitch":40.953},{"time":1.650,"pitch":40.963},{"time":1.658,"pitch":40.971},{"time":1.667,"pitch":40.977},{"time":1.675,"pitch":40.981},{"time":1.683,"pitch":40.985},{"time":1.692,"pitch":40.988},{"time":1.700,"pitch":40.991},{"time":1.708,"pitch":40.993},{"time":1.717,"pitch":40.994},{"time":1.725,"pitch":40.995},{"time":1.733,"pitch":40.996},{"time":1.742,"pitch":40.997},{"time":1.750,"pitch":40.998},{"time":1.767,"pitch":40.999},{"time":1.808,"pitch":41.000},{"time":2.008,"pitch":40.381},{"time":2.017,"pitch":39.890},{"time":2.025,"pitch":39.500},{"time":2.033,"pitch":39.191},{"time":2.042,"pitch":38.945},{"time":2.050,"pitch":38.750},{"time":2.058,"pitch":38.595},{"time":2.067,"pitch":38.472},{"time":2.075,"pitch":38.375},{"time":2.083,"pitch":38.298},{"time":2.092,"pitch":38.236},{"time":2.100,"pitch":38.187},{"time":2.108,"pitch":38.149},{"time":2.117,"pitch":38.118},{"time":2.125,"pitch":38.094},{"time":2.133,"pitch":38.074},{"time":2.142,"pitch":38.059},{"time":2.150,"pitch":38.047},{"time":2.158,"pitch":38.037},{"time":2.167,"pitch":38.030},{"time":2.175,"pitch":38.023},{"time":2.183,"pitch":38.019},{"time":2.192,"pitch":38.015},{"time":2.200,"pitch":38.012},{"time":2.208,"pitch":38.009},{"time":2.217,"pitch":38.007},{"time":2.225,"pitch":38.006},{"time":2.233,"pitch":38.005},{"time":2.242,"pitch":38.004},{"time":2.250,"pitch":38.003},{"time":2.258,"pitch":38.002},{"time":2.275,"pitch":38.001},{"time":2.317,"pitch":38.000},{"time":2.508,"volume":0.833},{"time":2.517,"volume":0.667},{"time":2.525,"volume":0.500},{"time":2.533,"volume":0.333},{"time":2.542,"volume":0.167},{"time":2.550,"volume":0.000},{"time":2.558,"volume":0}]}},{"noteOn":{"time":59.000,"k":[{"time":0.000,"pitch":38.000,"volume":0.167},{"time":0.008,"pitch":38.000,"volume":0.333},{"time":0.017,"volume":0.500},{"time":0.025,"volume":0.667},{"time":0.033,"volume":0.833},{"time":0.042,"volume":1.000},{"time":0.733,"pitch":38.619},{"time":0.742,"pitch":39.110},{"time":0.750,"pitch":39.500},{"time":0.758,"pitch":39.809},{"time":0.767,"pitch":40.055},{"time":0.775,"pitch":40.250},{"time":0.783,"pitch":40.405},{"time":0.792,"pitch":40.528},{"time":0.800,"pitch":40.625},{"time":0.808,"pitch":40.702},{"time":0.817,"pitch":40.764},{"time":0.825,"pitch":40.813},{"time":0.833,"pitch":40.851},{"time":0.842,"pitch":40.882},{"time":0.850,"pitch":40.906},{"time":0.858,"pitch":40.926},{"time":0.867,"pitch":40.941},{"time":0.875,"pitch":40.953},{"time":0.883,"pitch":40.963},{"time":0.892,"pitch":40.970},{"time":0.900,"pitch":40.977},{"time":0.908,"pitch":40.981},{"time":0.917,"pitch":40.985},{"time":0.925,"pitch":40.988},{"time":0.933,"pitch":40.991},{"time":0.942,"pitch":40.993},{"time":0.950,"pitch":40.994},{"time":0.958,"pitch":40.995},{"time":0.967,"pitch":40.996},{"time":0.975,"pitch":40.997},{"time":0.983,"pitch":40.998},{"time":1.000,"pitch":40.999},{"time":1.042,"pitch":41.000},{"time":1.258,"pitch":40.381},{"time":1.267,"pitch":39.890},{"time":1.275,"pitch":39.500},{"time":1.283,"pitch":39.191},{"time":1.292,"pitch":38.945},{"time":1.300,"pitch":38.750},{"time":1.308,"pitch":38.595},{"time":1.317,"pitch":38.472},{"time":1.325,"pitch":38.375},{"time":1.333,"pitch":38.298},{"time":1.342,"pitch":38.236},{"time":1.350,"pitch":38.187},{"time":1.358,"pitch":38.149},{"time":1.367,"pitch":38.118},{"time":1.375,"pitch":38.094},{"time":1.383,"pitch":38.074},{"time":1.392,"pitch":38.059},{"time":1.400,"pitch":38.047},{"time":1.408,"pitch":38.037},{"time":1.417,"pitch":38.030},{"time":1.425,"pitch":38.023},{"time":1.433,"pitch":38.019},{"time":1.442,"pitch":38.015},{"time":1.450,"pitch":38.012},{"time":1.458,"pitch":38.009},{"time":1.467,"pitch":38.007},{"time":1.475,"pitch":38.006},{"time":1.483,"pitch":38.005},{"time":1.492,"pitch":38.004},{"time":1.500,"pitch":38.622},{"time":1.508,"pitch":39.112},{"time":1.517,"pitch":39.502},{"time":1.525,"pitch":39.811},{"time":1.533,"pitch":40.056},{"time":1.542,"pitch":40.251},{"time":1.550,"pitch":40.405},{"time":1.558,"pitch":40.528},{"time":1.567,"pitch":40.625},{"time":1.575,"pitch":40.703},{"time":1.583,"pitch":40.764},{"time":1.592,"pitch":40.813},{"time":1.600,"pitch":40.851},{"time":1.608,"pitch":40.882},{"time":1.617,"pitch":40.906},{"time":1.625,"pitch":40.926},{"time":1.633,"pitch":40.941},{"time":1.642,"pitch":40.953},{"time":1.650,"pitch":40.963},{"time":1.658,"pitch":40.971},{"time":1.667,"pitch":40.977},{"time":1.675,"pitch":40.981},{"time":1.683,"pitch":40.985},{"time":1.692,"pitch":40.988},{"time":1.700,"pitch":40.991},{"time":1.708,"pitch":40.993},{"time":1.717,"pitch":40.994},{"time":1.725,"pitch":40.995},{"time":1.733,"pitch":40.996},{"time":1.742,"pitch":40.997},{"time":1.750,"pitch":40.998},{"time":1.767,"pitch":40.999},{"time":1.808,"pitch":41.000},{"time":2.008,"pitch":40.381},{"time":2.017,"pitch":39.890},{"time":2.025,"pitch":39.500},{"time":2.033,"pitch":39.191},{"time":2.042,"pitch":38.945},{"time":2.050,"pitch":38.750},{"time":2.058,"pitch":38.595},{"time":2.067,"pitch":38.472},{"time":2.075,"pitch":38.375},{"time":2.083,"pitch":38.298},{"time":2.092,"pitch":38.236},{"time":2.100,"pitch":38.187},{"time":2.108,"pitch":38.149},{"time":2.117,"pitch":38.118},{"time":2.125,"pitch":38.094},{"time":2.133,"pitch":38.074},{"time":2.142,"pitch":38.059},{"time":2.150,"pitch":38.047},{"time":2.158,"pitch":38.037},{"time":2.167,"pitch":38.030},{"time":2.175,"pitch":38.023},{"time":2.183,"pitch":38.019},{"time":2.192,"pitch":38.015},{"time":2.200,"pitch":38.012},{"time":2.208,"pitch":38.009},{"time":2.217,"pitch":38.007},{"time":2.225,"pitch":38.006},{"time":2.233,"pitch":38.005},{"time":2.242,"pitch":38.004},{"time":2.250,"pitch":38.003},{"time":2.258,"pitch":38.002},{"time":2.275,"pitch":38.001},{"time":2.317,"pitch":38.000},{"time":2.508,"volume":0.833},{"time":2.517,"volume":0.667},{"time":2.525,"volume":0.500},{"time":2.533,"volume":0.333},{"time":2.542,"volume":0.167},{"time":2.550,"volume":0.000},{"time":2.558,"volume":0}]}}],"f6341a2a81244ea79dd0e1486eb93386":[]}
	`
	//#endregion

	//#region Start

    csound = new Csound(csdText)
    csound.start()
	startAudioVisuals()

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
