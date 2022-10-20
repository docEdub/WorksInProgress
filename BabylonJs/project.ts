import * as BABYLON from "babylonjs"
import * as SHARED from "./SharedModules"

import * as csdJson from "../Csound/build/bounce/DawPlayback.min.json"

//#region Non-playground TypeScript declarations

declare global {
    interface Document {
        isProduction: boolean	// If falsey then we're running in the playground.
        debugAsserts: boolean	// If truthy then call `debugger` to break in `assert` function.
        alwaysRun: boolean	    // Always move camera fast on keyboard input, not just when caps lock is on.
        visible: boolean        // Set to `true` when browser/tab is visible; otherwise `false`.
        navigator: any
    }

    namespace AUDIO {
        class Engine {
            constructor(audioContext)
            sequenceTime: number
            onCameraMatrixChanged(matrix: BABYLON.Matrix): void
            readyObservable: BABYLON.Observable<void>
        }
    }
}

//#endregion

document.isProduction = true
document.debugAsserts = true
document.alwaysRun = true

const UrlParams = new URLSearchParams(window.location.search)

class Playground { public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {

    const groundSize = 9000
    const logDebugMessages = true
    const showBabylonInspector = false

    //#region Light and color

    class Light {
        static readonly MaxSimultaneous = 8
    }

    class Color {
        static readonly NeonBlue = [ 0.2, 0.2, 1 ]
        static readonly NeonGreen = [ 0.05, 0.7, 0.05 ]
        static readonly NeonOrange = [ 1, 0.5, 0.1 ]
        static readonly NeonPurple = [ 0.45, 0.1, 0.9 ]

        static readonly LightBrightRed = [ 1, 0.15, 0.15 ]
    }

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

    const HALF_PI = Math.PI / 2

    //#endregion

    //#region Fullscreen toggle

    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
        } else if (document.exitFullscreen) {
            document.exitFullscreen()
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            toggleFullScreen();
        }
    }, false);

    //#endregion

    //#region Babylon scene setup

    // The BabylonJS playground adds the materials extension to BABYLON.
    if (!document.isProduction && !BABYLON_MATERIALS)
        var BABYLON_MATERIALS = BABYLON

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine)
    if (UrlParams.get(`inspector`) === `true`) {
        scene.debugLayer.show()
    }

    //#endregion

    //#region class Camera

    class Camera {
        set position(value) {
            this.#flatScreenCamera.position.x = value[0]
            this.#flatScreenCamera.position.y = value[1]
            this.#flatScreenCamera.position.z = value[2]
        }

        get rotationY() {
            return this.camera.rotation.y
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
                this.matrix = this.#camera.worldMatrixFromCache

                if (0 < this.timeUntilMatrixUpdateInMs) {
                    this.timeUntilMatrixUpdateInMs -= engine.getDeltaTime()
                }
                if (this.timeUntilMatrixUpdateInMs <= 0) {
                    if (this._matrixIsDirty) {
                        for (let i = 0; i < this.registeredOnMatrixChangedCallbacks.length; i++) {
                            this.registeredOnMatrixChangedCallbacks[i](this.matrix)
                        }
                        this.timeUntilMatrixUpdateInMs += this.timeUntilMatrixUpdateInMs
                        this._matrixIsDirty = false
                    }
                    else {
                        this.timeUntilMatrixUpdateInMs = 0
                    }
                }
            })
        }

        private _isPositionLocked = false
        public get isPositionLocked() {
            return this._isPositionLocked
        }
        public lockPosition = () => {
            this._isPositionLocked = true
            this.#camera.position = this.setting.position
            this.#camera.target = this.setting.target
            this.#camera.keysUp.length = 0
            this.#camera.keysDown.length = 0
            this.#camera.keysLeft.length = 0
            this.#camera.keysRight.length = 0
        }

        _matrixUpdatesPerSecond = 10
        get matrixUpdatesPerSecond() { return this._matrixUpdatesPerSecond }
        set matrixUpdatesPerSecond(value) { this._matrixUpdatesPerSecond = value }
        get matrixMillisecondsPerUpdate() { return 1000 / this.matrixUpdatesPerSecond }

        private matrixTimePerUpdateInMs = 1000 / this._matrixUpdatesPerSecond
        private timeUntilMatrixUpdateInMs = 0
        private registeredOnMatrixChangedCallbacks = new Array<(matrix: BABYLON.Matrix) => void>()

        public registerOnMatrixChanged = (callback: (matrix: BABYLON.Matrix) => void) => {
            this.registeredOnMatrixChangedCallbacks.push(callback)
        }

        //#region Options

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
            { position: new BABYLON.Vector3(0, this.height, -315), target: new BABYLON.Vector3(0, 130, 0) },
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
            { position: new BABYLON.Vector3(0, this.height, 335), target: new BABYLON.Vector3(0, 135, 0) },
            // 8
            { position: new BABYLON.Vector3(halfGroundSize, this.height, halfGroundSize), target: new BABYLON.Vector3(0, 135, 0) },
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

        _matrix: BABYLON.Matrix = new BABYLON.Matrix
        _matrixIsDirty = true
        get matrixIsDirty() { return this._matrixIsDirty }
        set matrixIsDirty(value) { this._matrixIsDirty = value }

        get matrix() { return this._matrix }
        set matrix(value: BABYLON.Matrix) {
            if (!this.matrixIsDirty) {
                for (let i = 0; i < 16; i++) {
                    if (0.01 < Math.abs(value.m[i] - this._matrix.m[i])) {
                        this._matrixIsDirty = true
                        break
                    }
                }
            }
            if (this.matrixIsDirty) {
                this._matrix.copyFrom(value)
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

    const makeMesh = (positions, indices, uvs = null) => {
        let normals = []
        BABYLON.VertexData.ComputeNormals(positions, indices, normals)
        let vertexData = new BABYLON.VertexData()
        vertexData.positions = positions
        vertexData.indices = indices
        vertexData.normals = normals
        vertexData.uvs = uvs
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

    scene.clearColor.set(0, 0, 0, 1)
    scene.ambientColor.set(0, 0, 0)

    { // Walls

        const wall = BABYLON.MeshBuilder.CreatePlane('', {
            size: groundSize
        })
        wall.isVisible = false
        wall.position.y = halfGroundSize
        wall.freezeWorldMatrix()

        const northWall = wall.createInstance('')
        northWall.checkCollisions = true
        northWall.isVisible = false
        northWall.position.z = halfGroundSize + 0.1
        northWall.freezeWorldMatrix()

        const eastWall = wall.createInstance('')
        eastWall.checkCollisions = true
        eastWall.isVisible = false
        eastWall.position.x = halfGroundSize + 0.1
        eastWall.rotation.y = Math.PI / 2
        eastWall.freezeWorldMatrix()

        const southWall = wall.createInstance('')
        southWall.checkCollisions = true
        southWall.isVisible = false
        southWall.position.z = -halfGroundSize - 0.1
        southWall.rotation.y = Math.PI
        southWall.freezeWorldMatrix()

        const westWall = wall.createInstance('')
        westWall.checkCollisions = true
        westWall.isVisible = false
        westWall.position.x = -halfGroundSize - 0.1
        westWall.rotation.y = -Math.PI / 2
        westWall.freezeWorldMatrix()

    }

    const ground = BABYLON.MeshBuilder.CreatePlane('', {
        size: groundSize
    })
    ground.checkCollisions = true
    ground.rotation.set(Math.PI / 2, 0, 0)
    ground.freezeWorldMatrix()

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
    gridMaterial.disableLighting = true
    ground.material = gridMaterial

    //#endregion

    //#region XR experience handler

    document.navigator = navigator
    if (document.navigator.xr) {
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
    }

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

        constructor() {
            this._light.intensity = 0.5
        }

        exclude = (mesh) => {
            this._light.excludedMeshes.push(mesh)
        }
    }
    const sunLight = new SunLight

    //#endregion

    //#region MainTriangles mesh

    const mainTrianglesOuterMeshScale = 20
    const mainTrianglesOuterMeshRotationY = 0
    const mainTrianglesDefaultColor = [ 0.04, 0.04, 0.04 ]

    let mainTriangleMesh: BABYLON.Mesh = null
    let mainTriangleMeshHeight = 1

    let outerMainTriangleMesh = null
    let outerMainTriangleMeshMaterial = null
    const outerMainTrianglesDefaultColor = [ 0.03, 0.03, 0.03 ]

    let mainTriangleInnerMesh: BABYLON.Mesh = null
    let mainTriangleOuterMesh: BABYLON.Mesh = null
    let outerMainTriangleInnerMesh: BABYLON.Mesh = null
    let outerMainTriangleOuterMesh: BABYLON.Mesh = null

    let mainTriangleInnerMeshMaterial = null
    let mainTriangleOuterMeshMaterial = null
    let outerMainTriangleInnerMeshMaterial = null
    let outerMainTriangleOuterMeshMaterial = null

    const separateMainTriangleMesh = (mesh) => {
        mesh.isVisible = false

        const indexes = mesh.getIndices()!
        const points = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)!
        const normals = mesh.getNormalsData()!

        const innerIndexes = []
        const outerIndexes = []
        for (let i = 0; i < indexes.length; i++) {
            const normalY = normals[3 * i + 1]
            if (normalY < 0) {
                innerIndexes.push(indexes[i])
            }
            else {
                outerIndexes.push(indexes[i])
            }
        }

        const innerMesh = new BABYLON.Mesh(``)
        {
            const vertexData = new BABYLON.VertexData
            vertexData.indices = innerIndexes
            vertexData.normals = normals
            vertexData.positions = points
            vertexData.applyToMesh(innerMesh, true)
            innerMesh.material = mesh.material!.clone(``)
            sunLight.exclude(innerMesh)
        }

        const outerMesh = new BABYLON.Mesh(``)
        {
            const vertexData = new BABYLON.VertexData
            vertexData.indices = outerIndexes
            vertexData.normals = normals
            vertexData.positions = points
            vertexData.applyToMesh(outerMesh, true)
            outerMesh.material = mesh.material!.clone(``)
            sunLight.exclude(outerMesh)
        }

        return [ innerMesh, outerMesh ]
    }

    const meshString_MainTriangles = `
    {
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
            material.emissiveColor.fromArray(mainTrianglesDefaultColor)
            material.maxSimultaneousLights = Light.MaxSimultaneous
            material.specularColor.set(0.25, 0.25, 0.25)
            material.specularPower = 2

            const mesh = scene.getMeshByName('MainTriangles') as BABYLON.Mesh
            mesh.material = material
            mesh.isVisible = false
            sunLight.exclude(mesh)

            mainTriangleMesh = mesh
            mainTriangleMeshHeight = mesh.getBoundingInfo().boundingBox.maximumWorld.y

            const meshes = separateMainTriangleMesh(mesh)
            mainTriangleInnerMesh = meshes[0]
            mainTriangleOuterMesh = meshes[1]

            mainTriangleInnerMeshMaterial = mainTriangleInnerMesh.material
            mainTriangleOuterMeshMaterial = mainTriangleOuterMesh.material

            const outerMesh = mesh.clone('')
            outerMesh.rotation.y = mainTrianglesOuterMeshRotationY
            outerMesh.material = material
            sunLight.exclude(outerMesh)

            outerMainTriangleMesh = outerMesh
            outerMainTriangleMeshMaterial = material

            const outerMeshes = separateMainTriangleMesh(outerMesh)
            outerMainTriangleInnerMesh = outerMeshes[0]
            outerMainTriangleOuterMesh = outerMeshes[1]

            outerMainTriangleInnerMeshMaterial = outerMainTriangleInnerMesh.material
            outerMainTriangleOuterMeshMaterial = outerMainTriangleOuterMesh.material

            outerMainTriangleInnerMeshMaterial.emissiveColor.fromArray(outerMainTrianglesDefaultColor)
            outerMainTriangleOuterMeshMaterial.emissiveColor.fromArray(outerMainTrianglesDefaultColor)

            outerMainTriangleInnerMesh.scaling.setAll(mainTrianglesOuterMeshScale)
            outerMainTriangleOuterMesh.scaling.setAll(mainTrianglesOuterMeshScale)
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

    const makeBottomlessTrianglePolygonMeshWithUvs = () => {
        const mesh = makeMesh(
            [ 0, 1.225, 0,
              0, 0, 0.867,
              0.75, 0, -0.433,
              0.75, 0, -0.433,
              -0.75, 0, -0.433,
              -0.75, 0, -0.433,
              0, 0, 0.867,
            ],
            [ 0, 2, 1,
              0, 4, 3,
              0, 6, 5,
            ],
            [ 0.5, 1,
              1, 0,
              0, 0,
              1, 0,
              0, 0,
              1, 0,
              0, 0,
            ]
        )
        const boundingInfo = mesh.getBoundingInfo()
        boundingInfo.centerOn(BABYLON.Vector3.ZeroReadOnly, new BABYLON.Vector3(0.867, 1.225, 0.867))
        mesh.setBoundingInfo(boundingInfo)
        return mesh
    }

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

        resets = []

        previousValues = {}

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(ObjectPropertyResetComponent)) {
                    this.resets.push({component: component})
                }
            }
            assert(0 < this.resets.length, `${ObjectPropertyResetComponent.name} missing.`)
            this.#checkKeys()
            this.#initializePreviousValues()
        }

        run = (time, deltaTime) => {
            for (let i = 0; i < this.resets.length; i++) {
                const reset = this.resets[i]
                const object = reset.component.object
                const keys = reset.component.keys
                const previousValues = reset.previousValues
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i]
                    // console.debug(`resetting key ${key} from ${object[key]} to ${previousValues[key]}`)
                    object[key] = previousValues[key]
                }
            }
        }

        #checkKeys = () => {
            for (let i = 0; i < this.resets.length; i++) {
                const reset = this.resets[i]
                const object = reset.component.object
                const keys = reset.component.keys
                for (let i = 0; i < keys.length; i++) {
                    if (object[keys[i]] === undefined) {
                        console.warn(`Object key not found. Key = ${keys[i]}. Object = ${object}.`)
                    }
                }
            }
        }

        #initializePreviousValues = () => {
            for (let i = 0; i < this.resets.length; i++) {
                const reset = this.resets[i]
                const object = reset.component.object
                const keys = reset.component.keys
                const previousValues = {}
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i]
                    previousValues[key] = object[key]
                }
                reset.previousValues = previousValues
            }
        }
    }

    world.add(ObjectPropertyResetSystem)

    //#endregion

    //#region class MeshColorizerComponent

    // NB: This class assumes an ObjectPropertyResetComponent is added to the entity to reset the mesh colors on each
    // frame before this class adds its colors.
    class MeshColorizerComponent extends Component {
        #Private = class {
            color = [1, 1, 1]
            enabled = false
            factor = 1

            diffuseFactor = 0 // 0 to 1
            emissiveFactor = 1 // 0 to 1
            specularFactor = 0 // 0 to 1
            meshesToColorize = []
            originalDiffuseColors = [[]]
            originalEmissiveColors = [[]]
            originalSpecularColors = [[]]

            colorize = () => {
                if (this.factor === 0) {
                    return
                }

                for (let i = 0; i < this.meshesToColorize.length; i++) {
                    const material = this.meshesToColorize[i].material as BABYLON.StandardMaterial
                    if (0 < this.diffuseFactor) {
                        const color = material.diffuseColor
                        const finalFactor = this.factor * this.diffuseFactor
                        color.r = Math.min(1, color.r + this.color[0] * finalFactor)
                        color.g = Math.min(1, color.g + this.color[1] * finalFactor)
                        color.b = Math.min(1, color.b + this.color[2] * finalFactor)
                    }
                    if (0 < this.emissiveFactor) {
                        const color = material.emissiveColor
                        const finalFactor = this.factor * this.emissiveFactor
                        color.r = Math.min(1, color.r + this.color[0] * finalFactor)
                        color.g = Math.min(1, color.g + this.color[1] * finalFactor)
                        color.b = Math.min(1, color.b + this.color[2] * finalFactor)
                    }
                    if (0 < this.specularFactor) {
                        const color = material.specularColor
                        const finalFactor = this.factor * this.specularFactor
                        color.r = Math.min(1, color.r + this.color[0] * finalFactor)
                        color.g = Math.min(1, color.g + this.color[1] * finalFactor)
                        color.b = Math.min(1, color.b + this.color[2] * finalFactor)
                    }
                }
            }

            update = () => {
                if (this.enabled) {
                    this.colorize()
                }
            }
        }

        _private = new this.#Private

        set color(value: Array<number>) {
            this._private.color[0] = value[0]
            this._private.color[1] = value[1]
            this._private.color[2] = value[2]
            this._private.update()
        }

        set enabled(value: boolean) {
            this._private.enabled = value
            if (this._private.enabled) {
                this._private.colorize()
            }
        }

        get factor() {
            return this._private.factor
        }

        set factor(value: number) {
            this._private.factor = value
            this._private.update()
        }

        set diffuseFactor(value: number) {
            this._private.diffuseFactor = value
            this._private.update()
        }

        set emissiveFactor(value: number) {
            this._private.emissiveFactor = value
            this._private.update()
        }

        set specularFactor(value: number) {
            this._private.specularFactor = value
            this._private.update()
        }

        set meshesToColorize(value: Array<BABYLON.Mesh>) {
            const _private = this._private
            _private.meshesToColorize.length = value.length
            _private.originalDiffuseColors.length = value.length
            _private.originalEmissiveColors.length = value.length
            _private.originalSpecularColors.length = value.length
            for (let i = 0; i < value.length; i++) {
                _private.meshesToColorize[i] = value[i]
                const material = value[i].material as BABYLON.StandardMaterial
                _private.originalDiffuseColors[i] = material.diffuseColor.asArray()
                _private.originalEmissiveColors[i] = material.emissiveColor.asArray()
                _private.originalSpecularColors[i] = material.specularColor.asArray()
            }
        }

        enable = () => {
            this.enabled = true
        }

        disable = () => {
            this.enabled = false
        }
    }

    //#endregion

    //#region class SharedMeshBaseComponent

    class SharedMeshBaseComponent extends Component {
        _private = {
            mesh: null,
            normals: [],
            sharedMeshData: null
        }

        _protected = {
            initializeVertexData: () => {
                this._protected.updateNormals()
                let vertexData = new BABYLON.VertexData()
                vertexData.positions = this.sharedMeshData.vertexPositions
                vertexData.indices = this.sharedMeshData.vertexIndices
                vertexData.applyToMesh(this._private.mesh, true)
            },

            updateNormals: () => {
                BABYLON.VertexData.ComputeNormals(
                    this.sharedMeshData.vertexPositions,
                    this.sharedMeshData.vertexIndices,
                    this._private.normals)
            }
        }

        set material(value) {
            if (this._private.mesh === null) {
                return
            }
            this._private.mesh.material = value
        }

        set mesh(value) {
            this._private.mesh = value
        }

        get sharedMeshData() {
            return this._private.sharedMeshData
        }

        constructor(sharedMeshData) {
            super()
            this._private.sharedMeshData = sharedMeshData
        }
    }

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

            {
                const mesh = makeTrianglePolygonMesh()
                mesh.position.setAll(0)
                mesh.scaling.set(this.flashScalingMin, 1, this.flashScalingMin)
                mesh.bakeCurrentTransformIntoVertices()
                this._flashMesh = mesh

                const material = new BABYLON.StandardMaterial('', scene)
                material.alpha = 0.999
                material.emissiveColor.set(0.5, 0.5, 0.5)
                mesh.material = material
                this._flashMeshMaterial = material

                sunLight.exclude(mesh)
            }

            {
                const mesh = mainTriangleMesh.clone(``, mainTriangleMesh.parent)
                mesh.makeGeometryUnique()
                mesh.isVisible = true
                this._strikerLegsMesh = mesh

                const material = new BABYLON.StandardMaterial('', scene)
                material.emissiveColor.set(0.5, 0.5, 0.5)
                mesh.material = material
                this._strikerLegsMeshMaterial = material

                sunLight.exclude(mesh)
            }

            {
                const mesh = makeTrianglePolygonMesh()
                mesh.isVisible = true
                mesh.parent = this._strikerLegsMesh
                mesh.scaling.set(210, 178, 210)
                this._strikerGlassMesh = mesh

                const material = new BABYLON.StandardMaterial('', scene)
                material.alpha = 0.5
                material.backFaceCulling = false
                material.emissiveColor.set(0.5, 0.5, 0.5)
                material.maxSimultaneousLights = Light.MaxSimultaneous
                material.specularPower = 0.25
                mesh.material = material
                this._strikerGlassMeshMaterial = material

                sunLight.exclude(mesh)
            }

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

            this._mesh.freezeWorldMatrix()

            sunLight.exclude(this._mesh)
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
        pitchFloor = 59
        rotationSpeed = 2

        get color() { return this._meshMaterial.emissiveColor.asArray() }
        set color(value) {
            this._meshMaterial.emissiveColor.set(value[0] / 1.1, value[1] / 1.1, value[2] / 1.1)
            this._meshMaterial.diffuseColor.copyFrom(this._meshMaterial.emissiveColor)
            this._pillarMeshMaterial.emissiveColor.fromArray(value)
        }

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
            this._mesh.unfreezeWorldMatrix()
            this._pillarMesh.unfreezeWorldMatrix()

            this._mesh.position.fromArray(value)
            this._pillarMesh.position.fromArray(value)

            this._mesh.freezeWorldMatrix()
            this._pillarMesh.freezeWorldMatrix()
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

            const triangleMeshX = 1.367
            const triangleMesh1 = makeTrianglePolygonMesh()
            triangleMesh1.position.x = triangleMeshX
            triangleMesh1.rotation.x = triangleMesh1.rotation.z = Math.PI / 2
            triangleMesh1.bakeCurrentTransformIntoVertices()
            const triangleMesh2 = makeTrianglePolygonMesh()
            triangleMesh2.position.x = triangleMeshX
            triangleMesh2.rotation.x = triangleMesh2.rotation.z = Math.PI / 2
            triangleMesh2.rotateAround(BABYLON.Vector3.ZeroReadOnly, BABYLON.Vector3.UpReadOnly, -0.667 * Math.PI)
            triangleMesh2.bakeCurrentTransformIntoVertices()
            const triangleMesh3 = makeTrianglePolygonMesh()
            triangleMesh3.position.x = triangleMeshX
            triangleMesh3.rotation.x = triangleMesh3.rotation.z = Math.PI / 2
            triangleMesh3.rotateAround(BABYLON.Vector3.ZeroReadOnly, BABYLON.Vector3.UpReadOnly, 0.667 * Math.PI)
            triangleMesh3.bakeCurrentTransformIntoVertices()

            this._mesh = BABYLON.Mesh.MergeMeshes([ triangleMesh1, triangleMesh2, triangleMesh3 ], true)
            this._mesh.freezeWorldMatrix()
            this._meshMaterial = new BABYLON.StandardMaterial('', scene)
            this._meshMaterial.specularColor.set(0.1, 0.1, 0.1)
            this._mesh.material = this._meshMaterial

            this._pillarMesh = makeTrianglePolygonMesh()
            this._pillarMesh.isVisible = true
            this._pillarMesh.scaling.set(1, 10, 1)
            this._pillarMesh.freezeWorldMatrix()
            this._pillarMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._pillarMeshMaterial.specularColor.set(0.003, 0.003, 0.003)
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

            this.animation.setActiveNoteDataAt(0, 1, 0, this.track.notes[1].pitch)
            this.animation.setActiveNoteDataAt(1, 1, 0, this.track.notes[2].pitch)
            this.animation.updateActiveNoteDataMatrixes()
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
                this.meshesToColor[i]?.material.emissiveColor.fromArray(mainTrianglesDefaultColor)
            }
            outerMainTriangleInnerMeshMaterial.emissiveColor.fromArray(outerMainTrianglesDefaultColor)
            outerMainTriangleOuterMeshMaterial.emissiveColor.fromArray(outerMainTrianglesDefaultColor)
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

        _frameMesh = new BABYLON.Mesh('', scene)
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
                BABYLON.Color3.HSVtoRGBToRef(hue, 0.95, 0.155, this.meshesToColor[i].material.emissiveColor)
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

            this._mesh = trianglePlaneMesh.clone('')
            this._meshMaterial = new BABYLON.StandardMaterial('', scene)
            this._meshMaterial.alpha = 0.75
            this._meshMaterial.backFaceCulling = false
            this._meshMaterial.emissiveColor.set(1, 1, 1)
            this._meshMaterial.maxSimultaneousLights = Light.MaxSimultaneous
            this._mesh.material = this._meshMaterial
            sunLight.exclude(this._mesh)

            this._frameMesh = new BABYLON.Mesh(``, scene)
            this._frameMesh.isVisible = false
            this._frameMeshMaterial = new BABYLON.StandardMaterial('', scene)
            this._frameMeshMaterial.emissiveColor.set(1, 0, 0)
            this._frameMeshMaterial.maxSimultaneousLights = Light.MaxSimultaneous
            this._frameMesh.material = this._frameMeshMaterial
            sunLight.exclude(this._frameMesh)

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

    //#region class RimMeshBaseComponent

    class RimMeshBaseComponent extends SharedMeshBaseComponent {
        constructor(sharedMeshData) {
            super(sharedMeshData)
            this.mesh = new BABYLON.Mesh(``, scene)

            const material = new BABYLON.StandardMaterial('', scene)
            material.backFaceCulling = false
            material.diffuseColor = material.specularColor.set(0, 0, 0)
            material.emissiveColor.set(0.06, 0.06, 0.06)
            material.wireframe = true
            this.material = material

            this._protected.initializeVertexData()
        }
    }

    //#endregion

    //#region class RimArpAnimationComponent

    class RimArpAnimationComponent extends RimMeshBaseComponent {
        color = [ 0.5, 0.5, 0.5 ]

        constructor(mesh) {
            super(mesh)
        }
    }

    //#endregion

    //#region class RimArpAnimationSystem

    class RimArpAnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            RimArpAnimationComponent,
            MeshColorizerComponent
        ]}

        track = null
        animation = null
        meshColorizer = null

        mesh = new BABYLON.Mesh(``, scene)
        instanceMatrices = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(RimArpAnimationComponent)) {
                    this.animation = component
                }
                else if (component.isA(MeshColorizerComponent)) {
                    this.meshColorizer = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${RimArpAnimationComponent.name} missing.`)
            assert(this.meshColorizer, `${MeshColorizerComponent.name} missing.`)

            const material = new BABYLON.StandardMaterial('', scene)
            material.backFaceCulling = false
            material.emissiveColor.fromArray(this.animation.color)
            this.mesh.material = material

            const positions = [
                0, 0, 1,
                0, 0, -1.13,
                -1, 1, -0.0515
            ]
            const indices = [
                0, 1, 2
            ]
            const vertexData = new BABYLON.VertexData
            vertexData.positions = positions
            vertexData.indices = indices
            vertexData.applyToMesh(this.mesh, true)

            this.instanceMatrices = new Array<BABYLON.Matrix>(this.track.header.positionCount).fill(new BABYLON.Matrix)
            this.mesh.thinInstanceAdd(this.instanceMatrices, false)

            this.mesh.freezeWorldMatrix()
        }

        run = (time, deltaTime) => {
            this.meshColorizer.enabled = 0 < this.track.activeNotes.length
            if (this.track.activeNotesChanged) {
                if (0 < this.track.activeNotes.length) {
                    // Update and show mesh thin instances.
                    const activeNote = this.track.activeNotes[this.track.activeNotes.length - 1]
                    const faceMatrices = SHARED.Rim1HiArpMesh.faceMatrices
                    // console.debug(`index = ${activeNote.positionIndex} of ${faceMatrices.length}`)
                    const positionIndexOffset = this.track.header.positionIndexOffset
                    const row = Math.floor(activeNote.positionIndex / (SHARED.Rim1HiArpMesh.segments / 2)) + 1
                    const maxRowIndex = row * (SHARED.Rim1HiArpMesh.segments / 2)
                    for (let i = 0; i < this.track.header.positionCount; i++) {
                        let faceMatrixIndex = activeNote.positionIndex + i * positionIndexOffset
                        if (faceMatrixIndex >= maxRowIndex) {
                            faceMatrixIndex -= faceMatrices.length / SHARED.Rim1HiArpMesh.rows
                        }
                        // console.debug(`faceMatrixIndex ${i} = ${faceMatrixIndex}`)
                        // const xformedCoords = BABYLON.Vector3.TransformCoordinates(new BABYLON.Vector3(-1, 1, 0), faceMatrices[faceMatrixIndex])
                        this.mesh.thinInstanceSetMatrixAt(i, faceMatrices[faceMatrixIndex], i === this.track.header.positionCount - 1)
                    }
                    // this.mesh.thinInstanceBufferUpdated('matrix')
                    this.mesh.isVisible = true
                }
                else {
                    // Hide mesh thin instances.
                    this.mesh.isVisible = false
                }
            }
        }
    }

    world.add(RimArpAnimationSystem)

    //#endregion

    //#region class RimLineAnimationComponent

    class RimLineAnimationComponent extends RimMeshBaseComponent {
        color = [ 0.5, 0.5, 0.5 ]

        _noteNumbers = []

        get noteNumbers() {
            return this._noteNumbers
        }

        set noteNumbers(value) {
            this._noteNumbers = value
            this.#initRowMeshes()
        }

        showNoteNumber = (noteNumber) => {
            this.#setNoteNumberVisible(noteNumber, true)
        }

        hideNoteNumber = (noteNumber) => {
            this.#setNoteNumberVisible(noteNumber, false)
        }

        setNoteNumberAlpha = (noteNumber, alpha) => {
            this._rowMeshMaterials[this.#rowOfNoteNumber(noteNumber)].alpha = alpha
        }

        #rowOfNoteNumber = (noteNumber) => {
            return this.noteNumbers.indexOf(noteNumber)
        }

        #setNoteNumberVisible = (noteNumber, visible) => {
            this._rowMeshes[this.#rowOfNoteNumber(noteNumber)].isVisible = visible
        }

        _rowMeshes = []
        _rowMeshMaterials = []

        #initRowMeshes = () => {
            // console.debug(`#initRowMeshes() called on ${this.sharedMeshData.constructor.name}`)
            for (let i = 0; i < this.sharedMeshData.rows; i++) {
                const mesh = new BABYLON.Mesh('', scene)
                mesh.isVisible = false

                const material = new BABYLON.StandardMaterial('', scene)
                material.emissiveColor.fromArray(this.color)
                material.backFaceCulling = false
                mesh.material = material

                let normals = []
                let indices = this.sharedMeshData.vertexIndices.slice(
                    i * 3 * this.sharedMeshData.segments,
                    (i + 1) * 3 * this.sharedMeshData.segments
                )
                BABYLON.VertexData.ComputeNormals(this.sharedMeshData.vertexPositions, indices, normals)
                const vertexData = new BABYLON.VertexData
                vertexData.positions = this.sharedMeshData.vertexPositions
                vertexData.indices = indices
                vertexData.normals = normals
                vertexData.applyToMesh(mesh)

                mesh.freezeWorldMatrix()
                sunLight.exclude(mesh)

                this._rowMeshes.push(mesh)
                this._rowMeshMaterials.push(material)
            }
        }

        constructor(mesh) {
            super(mesh)
        }
    }

    //#endregion

    //#region class RimLineAnimationSystem

    class RimLineAnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            TrackNoteDurationComponent,
            TrackNoteNormalizedDurationComponent,
            RimLineAnimationComponent,
            MeshColorizerComponent
        ]}

        track = null
        animation = null
        meshColorizer = null

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(RimLineAnimationComponent)) {
                    this.animation = component
                }
                else if (component.isA(MeshColorizerComponent)) {
                    this.meshColorizer = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${RimLineAnimationComponent.name} missing.`)
            assert(this.meshColorizer, `${MeshColorizerComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            if (this.track.activeNotesChanged) {
                const noteNumbers = this.animation.noteNumbers
                for (let i = 0; i < noteNumbers.length; i++) {
                    this.animation.hideNoteNumber(noteNumbers[i])
                }
                for (let i = 0; i < this.track.activeNotes.length; i++) {
                    this.animation.showNoteNumber(this.track.activeNotes[i].pitch)
                }
            }

            if (0 < this.track.activeNotes.length) {
                let meshColorizationFactor = 0
                for (let i = 0; i < this.track.activeNotes.length; i++) {
                    const note = this.track.activeNotes[i]
                    const durationFactor = 1 - note.normalizedDuration
                    this.animation.setNoteNumberAlpha(note.pitch, durationFactor)
                    meshColorizationFactor += durationFactor
                }
                this.meshColorizer.emissiveFactor = Math.min(meshColorizationFactor, 1)
                this.meshColorizer.enable()
            }
            else {
                this.meshColorizer.disable()
            }
        }
    }

    world.add(RimLineAnimationSystem)

    //#endregion

    //#region class Flyer1AnimationComponent

    class Flyer1AnimationComponent extends Component {
        fps = 120

        get color() { return this._flyerMeshMaterial.emissiveColor.asArray() }
        set color(value) {
            this._flyerMeshMaterial.emissiveColor.fromArray(value)
        }

        start = (flyerIndex, directionIndex) => {
            this._flyerLights[flyerIndex][directionIndex].range = 750
            this._flyerMeshes[flyerIndex][directionIndex].isVisible = true
            if (directionIndex == 0 || !this._flyerMeshes[flyerIndex][0].isVisible) {
                scene.beginAnimation(
                    this._flyerNodes[flyerIndex][directionIndex],
                    0,
                    this.fps * this._pathsPoints[flyerIndex][directionIndex].length,
                    false,
                    this._speedMultipliers[flyerIndex][directionIndex]
                )
            }
        }

        stop = (flyerIndex, directionIndex) => {
            scene.stopAnimation(this._flyerNodes[flyerIndex][directionIndex])
            this._flyerMeshes[flyerIndex][directionIndex].isVisible = false
            this._flyerLights[flyerIndex][directionIndex].range = 0
        }

        updateMirroredFlyer = (flyerIndex) => {
            const node = this._flyerNodes[flyerIndex][0]
            const mirroredNode = this._flyerNodes[flyerIndex][1]
            mirroredNode.position.set(node.position.x, node.position.y, -node.position.z)
        }

        _flyerNodes = [[]] // [note][flyer direction]
        _flyerLights = [[]]
        _flyerMeshes = [[]]
        _flyerMeshMaterial = null

        _paths = null
        _pathsPoints = [
            [ SHARED.Flyer1Path.points, SHARED.Flyer1Path.pointsCounterClockwise ],
            [ SHARED.Flyer2Path.points, SHARED.Flyer2Path.pointsCounterClockwise ],
            [ SHARED.Flyer3Path.points, SHARED.Flyer3Path.pointsCounterClockwise ]
        ]
        _speedMultipliers = [
            [ SHARED.Flyer1Path.speedMultiplier, SHARED.Flyer1Path.speedMultiplier ],
            [ SHARED.Flyer2Path.speedMultiplier, SHARED.Flyer2Path.speedMultiplier ],
            [ SHARED.Flyer3Path.speedMultiplier, SHARED.Flyer3Path.speedMultiplier ]
        ]

        #makeTriangleTube = (path) => {
            const positions = [
                0, 1, 0,
                0.866, -0.5, 0,
                -0.866, -0.5, 0
            ]
            const indices = [
                0, 1, 2
            ]
            const mesh = new BABYLON.Mesh('', scene)
            let vertexData = new BABYLON.VertexData()
            vertexData.positions = positions
            vertexData.indices = indices
            vertexData.applyToMesh(mesh, true)

            mesh.scaling.setAll(10)
            mesh.bakeCurrentTransformIntoVertices()

            const material = new BABYLON.StandardMaterial('', scene)
            material.backFaceCulling = false
            material.diffuseColor = material.specularColor.set(0.01, 0.01, 0.01)
            material.emissiveColor.set(1, 1, 1)//set(0.1, 0.1, 0.1)
            material.wireframe = true
            mesh.material = material

            const instanceMatrices = []
            const pathPoints = path.getPoints()
            const tangents = path.getTangents();
            const binormals = path.getBinormals();
            const normals = path.getNormals();
            for (let i = 0; i < pathPoints.length; i++) {
                const translationXform = BABYLON.Matrix.Translation(pathPoints[i].x, pathPoints[i].y, pathPoints[i].z)
                const rotationXform = new BABYLON.Matrix()
                BABYLON.Matrix.FromXYZAxesToRef(normals[i], binormals[i], tangents[i], rotationXform)
                instanceMatrices.push(rotationXform.multiply(translationXform))
            }
            mesh.thinInstanceAdd(instanceMatrices, true)
        }

        #visualizePath = (path) => {
            const tangents = path.getTangents();
            const normals = path.getNormals();
            const binormals = path.getBinormals();
            const curve = path.getCurve();

            const curveLines = BABYLON.MeshBuilder.CreateLines('', { points: curve, updatable: false }, scene);
            const tangentLines = [];
            const normalLines = [];
            const binormalLines = [];
            for (let i = 0; i < curve.length; i++) {
                tangentLines[i] = BABYLON.MeshBuilder.CreateLines('', { points: [curve[i], curve[i].add(tangents[i])], updatable: false }, scene);
                tangentLines[i].color = BABYLON.Color3.Red();
                normalLines[i] = BABYLON.MeshBuilder.CreateLines('', { points: [curve[i], curve[i].add(normals[i])], updatable: false }, scene);
                normalLines[i].color = BABYLON.Color3.Blue();
                binormalLines[i] = BABYLON.MeshBuilder.CreateLines('', { points: [curve[i], curve[i].add(binormals[i])], updatable: false }, scene);
                binormalLines[i].color = BABYLON.Color3.Green();
            }
        }

        #makeFlyerMeshAnimation = (flyerIndex, directionIndex) => {
            const node = this._flyerNodes[flyerIndex][directionIndex]
            const path = this._paths[flyerIndex][directionIndex]

            const pathPoints = path.getPoints()

            const positionAnimation = new BABYLON.Animation('', 'position', this.fps, BABYLON.Animation.ANIMATIONTYPE_VECTOR3)
            const positionKeys = []

            for (let i = 0; i < pathPoints.length; i++) {
                const frame = this.fps * i
                const position = pathPoints[i]
                positionKeys.push({ frame: frame, value: position })
            }

            positionAnimation.setKeys(positionKeys)
            node.animations.push(positionAnimation)
        }

        constructor() {
            super()

            this._paths = [
                [ new BABYLON.Path3D(this._pathsPoints[0][0]), new BABYLON.Path3D(this._pathsPoints[0][1]) ],
                [ new BABYLON.Path3D(this._pathsPoints[1][0]), new BABYLON.Path3D(this._pathsPoints[1][1]) ],
                [ new BABYLON.Path3D(this._pathsPoints[2][0]), new BABYLON.Path3D(this._pathsPoints[2][1]) ]
            ]
            // this.#visualizePath(this._paths[0][0])
            // this.#visualizePath(this._paths[0][1])
            // this.#visualizePath(this._paths[1][0])
            // this.#visualizePath(this._paths[1][1])
            // this.#visualizePath(this._paths[2][0])
            // this.#visualizePath(this._paths[2][1])
            // this.#makeTriangleTube(this._paths[0][0])
            // this.#makeTriangleTube(this._paths[0][1])
            // this.#makeTriangleTube(this._paths[1][0])
            // this.#makeTriangleTube(this._paths[1][1])
            // this.#makeTriangleTube(this._paths[2][0])
            // this.#makeTriangleTube(this._paths[2][1])

            const flyerNode = new BABYLON.TransformNode('')
            this._flyerNodes = [
                [ flyerNode, flyerNode.clone('', null) ],
                [ flyerNode.clone('', null), flyerNode.clone('', null) ],
                [ flyerNode.clone('', null), flyerNode.clone('', null) ]
            ]

            const flyerLight = new BABYLON.PointLight('', BABYLON.Vector3.ZeroReadOnly, scene)
            flyerLight.intensity = 0.75
            flyerLight.diffuse.fromArray(Color.LightBrightRed)
            flyerLight.specular.fromArray(Color.LightBrightRed)
            flyerLight.specular.r /= 5
            flyerLight.specular.g /= 5
            flyerLight.specular.b /= 5
            flyerLight.range = 0
            this._flyerLights = [
                [ flyerLight, flyerLight.clone('') ],
                [ flyerLight.clone(''), flyerLight.clone('') ],
                [ flyerLight.clone(''), flyerLight.clone('') ]
            ]

            const flyerMesh = makeTrianglePolygonMesh()
            flyerMesh.isVisible = false
            flyerMesh.scaling.setAll(7.5)
            const material = new BABYLON.StandardMaterial('', scene)
            material.emissiveColor.set(1, 0.2, 0.2)
            flyerMesh.material = material
            this._flyerMeshes = [
                [ flyerMesh, flyerMesh.clone() ],
                [ flyerMesh.clone(), flyerMesh.clone() ],
                [ flyerMesh.clone(), flyerMesh.clone() ]
            ]
            this._flyerMeshMaterial = material

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 2; j++) {
                    this._flyerLights[i][j].parent = this._flyerNodes[i][j]
                    this._flyerMeshes[i][j].parent = this._flyerNodes[i][j]
                    sunLight.exclude(this._flyerMeshes[i][j])
                }
            }

            this.#makeFlyerMeshAnimation(0, 0)
            this.#makeFlyerMeshAnimation(0, 1)
            this.#makeFlyerMeshAnimation(1, 0)
            this.#makeFlyerMeshAnimation(1, 1)
            this.#makeFlyerMeshAnimation(2, 0)
            this.#makeFlyerMeshAnimation(2, 1)
        }
    }

    //#endregion

    //#region class Flyer1AnimationSystem

    class Flyer1AnimationSystem extends System {
        static requiredComponentTypes = () => { return [
            TrackComponent,
            Flyer1AnimationComponent
        ]}

        track = null
        animation = null

        activeNotes = []
        noteFlyerIndexMap = {
            98: 0, // D
            101: 1, // F
            105: 2 // A
        }

        constructor(components) {
            super(components)
            for (let i = 0; i < components.length; i++) {
                const component = components[i]
                if (component.isA(TrackComponent)) {
                    this.track = component
                }
                else if (component.isA(Flyer1AnimationComponent)) {
                    this.animation = component
                }
            }
            assert(this.track, `${TrackComponent.name} missing.`)
            assert(this.animation, `${Flyer1AnimationComponent.name} missing.`)
        }

        run = (time, deltaTime) => {
            if (this.track.activeNotesChanged) {
                // Turn finished notes off.
                for (let i = 0; i < this.activeNotes.length; i++) {
                    const note = this.activeNotes[i]
                    let found = false
                    for (let j = 0; j < this.track.activeNotes.length; j++) {
                        if (note === this.track.activeNotes[j]) {
                            found = true
                            break
                        }
                    }
                    if (!found) {
                        if (note.flyerDirection == 3) {
                            this.animation.stop(this.noteFlyerIndexMap[note.pitch], 0)
                            this.animation.stop(this.noteFlyerIndexMap[note.pitch], 1)
                        }
                        else {
                            this.animation.stop(this.noteFlyerIndexMap[note.pitch], note.flyerDirection - 1)
                        }
                        this.activeNotes.splice(i, 1)
                    }
                }
                // Turn started notes on.
                if (0 < this.track.activeNotes.length) {
                    for (let i = 0; i < this.track.activeNotes.length; i++) {
                        const note = this.track.activeNotes[i]
                        let found = false
                        for (let j = 0; j < this.activeNotes.length; j++) {
                            if (note === this.activeNotes[j]) {
                                found = true
                                break
                            }
                        }
                        if (!found) {
                            const flyerIndex = this.noteFlyerIndexMap[note.pitch]
                            if (note.flyerDirection == 3) {
                                this.animation.start(flyerIndex, 0)
                                this.animation.start(flyerIndex, 1)
                            }
                            else {
                                this.animation.start(flyerIndex, note.flyerDirection - 1)
                            }
                            this.activeNotes.push(note)
                        }
                    }
                }
            }
            for (let i = 0; i < this.track.activeNotes.length; i++) {
                const note = this.track.activeNotes[i]
                if (note.flyerDirection == 3) {
                    const flyerIndex = this.noteFlyerIndexMap[note.pitch]
                    this.animation.updateMirroredFlyer(flyerIndex)
                }
            }
        }
    }

    world.add(Flyer1AnimationSystem)

    //#endregion

    // World setup

    //#region World center light setup

    class CenterLight {
        get r() { return this._light.diffuse.r }
        set r(value) { this._light.diffuse.r = this._light.specular.r = value }

        get g() { return this._light.diffuse.g }
        set g(value) { this._light.diffuse.g = this._light.specular.g = value }

        get b() { return this._light.diffuse.b }
        set b(value) { this._light.diffuse.b = this._light.specular.b = value }

        get intensity() { return this._light.intensity }
        set intensity(value) { this._light.intensity = value }

        constructor() {
            {
                const light = this._light
                light.diffuse.set(0.1, 0.1, 0.1)
                light.specular.set(0.1, 0.1, 0.1)
                light.intensity = 0.5
                light.range = 250
            }

            const entity = new Entity
            const reset = new ObjectPropertyResetComponent
            reset.object = this
            reset.keys = [ 'r', 'g', 'b', 'intensity' ]
            entity.addComponent(reset)
            world.add(entity)
        }

        _light = new BABYLON.PointLight('', new BABYLON.Vector3(0, 0, 0), scene)
    }

    const centerLight = new CenterLight

    const addCenterLightFlashComponent = (entity, color) => {
        const callback = new TrackActiveNotesChangedCallbackComponent
        const addedColor = [...color]
        addedColor[0] *= 0.333
        addedColor[1] *= 0.333
        addedColor[2] *= 0.333
        callback.function = (activeNotes) => {
            if (0 < activeNotes.length) {
                centerLight.r += addedColor[0]
                centerLight.g += addedColor[1]
                centerLight.b += addedColor[2]
                centerLight.intensity += 0.25
            }
        }
        entity.addComponent(callback)
    }

    //#endregion

    //#region World track setup

    const beaconTrackId = 'fd575f03378047af835c19ef4f7d5991'
    const rim1TrackId = 'd51fb1d5a0104857a7f61b218692743c'
    const rim2TrackId = '14afc0dff693459fb6fc521bcf3db0bc'
    const rim3TrackId = '5006b8ea266f4bf9aba92ff5badfea3e'
    const flyer1TrackId = '89fb9657327e406b80a253b6c9d69b8a'

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
        addCenterLightFlashComponent(entity, options.color)
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
        addCenterLightFlashComponent(entity, options.color)
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
        if (options.color != undefined) {
            animation.color = options.color
        }
        let position = json[1].note.xyz
        if (options.x != undefined) {
            position[0] = options.x
        }
        if (options.z != undefined) {
            position[2] = options.z
        }
        animation.position = position
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

    const createRimArpAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)

        for (let i = 0; i < options.meshesToColor.length; i++) {
            const material = options.meshesToColor[i].material as BABYLON.StandardMaterial
            const reset = new ObjectPropertyResetComponent
            reset.object = material.emissiveColor
            reset.keys = [ 'r', 'g', 'b' ]
            entity.addComponent(reset)
        }

        const meshColorizer = new MeshColorizerComponent
        meshColorizer.color = options.color
        meshColorizer.factor = options.meshColorizationFactor
        meshColorizer.diffuseFactor = 0
        meshColorizer.emissiveFactor = 1
        meshColorizer.specularFactor = 0
        meshColorizer.meshesToColorize = options.meshesToColor
        entity.addComponent(meshColorizer)

        const animation = new RimArpAnimationComponent(options.mesh)
        if (options.color !== undefined) {
            animation.color = options.color
        }
        entity.addComponent(animation)

        return entity
    }

    const createRimLineAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)

        const duration = new TrackNoteDurationComponent
        entity.addComponent(duration)

        const normalizedDuration = new TrackNoteNormalizedDurationComponent
        entity.addComponent(normalizedDuration)

        for (let i = 0; i < options.meshesToColor.length; i++) {
            const material = options.meshesToColor[i].material as BABYLON.StandardMaterial
            const reset = new ObjectPropertyResetComponent
            reset.object = material.emissiveColor
            reset.keys = ['r', 'g', 'b']
            entity.addComponent(reset)
        }

        const meshColorizer = new MeshColorizerComponent
        meshColorizer.color = options.color
        meshColorizer.factor = options.meshColorizationFactor
        meshColorizer.diffuseFactor = 0
        meshColorizer.emissiveFactor = 1
        meshColorizer.specularFactor = 0
        meshColorizer.meshesToColorize = options.meshesToColor
        entity.addComponent(meshColorizer)

        const animation = new RimLineAnimationComponent(options.mesh)
        if (options.color !== undefined) {
            animation.color = options.color
        }
        animation.noteNumbers = options.noteNumbers
        entity.addComponent(animation)

        return entity
    }

    const createFlyerAnimation = (id, json, options) => {
        const entity = createTrack(id, json, options)
        const animation = new Flyer1AnimationComponent
        if (options.color != undefined) {
            animation.color = options.color
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

    const trackOptionsMap = {}
    const javascriptScoreLines = []

    trackOptionsMap['e274e9138ef048c4ba9c4d42e836c85c'] = {
        function: createDrumAnimation,
        options: {
            name: '00: Kick 1',
            totalDuration: kickOptions.totalDuration,
            color: Color.NeonOrange,
            flashScalingMin: kickOptions.flashScalingMin,
            flashScalingMax: kickOptions.flashScalingMax,
            strikerMeshScaling: kickOptions.strikerMeshScaling,
            strikerMeshY: kickOptions.strikerMeshY
        }
    }

    trackOptionsMap['8aac7747b6b44366b1080319e34a8616'] = {
        function: createDrumAnimation,
        options: {
            name: '01: Kick 2: Left',
            totalDuration: kickOptions.totalDuration,
            color: Color.NeonGreen,
            flashScalingMin: kickOptions.flashScalingMin,
            flashScalingMax: kickOptions.flashScalingMax,
            strikerMeshScaling: kickOptions.strikerMeshScaling,
            strikerMeshY: kickOptions.strikerMeshY
        }
    }

    trackOptionsMap['8e12ccc0dff44a4283211d553199a8cd'] = {
        function: createDrumAnimation,
        options: {
            name: '02: Kick 2: Right',
            totalDuration: kickOptions.totalDuration,
            color: Color.NeonPurple,
            flashScalingMin: kickOptions.flashScalingMin,
            flashScalingMax: kickOptions.flashScalingMax,
            strikerMeshScaling: kickOptions.strikerMeshScaling,
            strikerMeshY: kickOptions.strikerMeshY
        }
    }

    trackOptionsMap['6aecd056fd3f4c6d9a108de531c48ddf'] = {
        function: createDrumAnimation,
        options: {
            name: '03: Snare',
            totalDuration: snareOptions.totalDuration,
            color: Color.NeonBlue,
            flashScalingMin: snareOptions.flashScalingMin,
            flashScalingMax: snareOptions.flashScalingMax,
            strikerMeshScaling: snareOptions.strikerMeshScaling,
            strikerMeshY: snareOptions.strikerMeshY
        }
    }

    trackOptionsMap['e3e7d57082834a28b53e021beaeb783d'] = {
        function: createHiHatAnimation,
        options: {
            name: '04: HiHat 1',
            totalDuration: 0.034,
            color: [ 1, 0.333, 0.333 ],
            y: 20
        }
    }

    trackOptionsMap['02c103e8fcef483292ebc49d3898ef96'] = {
        function: createHiHatAnimation,
        options: {
            name: '05: HiHat 2',
            totalDuration: 0.034,
            color: [ 0.333, 0.333, 1 ],
            y: 60
        }
    }

    trackOptionsMap[beaconTrackId] = {
        function: createBeaconAnimation,
        options: {
            name: '06: Beacon',
            color: Color.NeonBlue,
            x: 0,
            z: 300
        }
    }
    javascriptScoreLines.push({
        trackId: beaconTrackId,
        parameters: [
            `Position/X/Offset`,
            `${trackOptionsMap[beaconTrackId].options.x}`
        ]
    })
    javascriptScoreLines.push({
        trackId: beaconTrackId,
        parameters: [
            `Position/Z/Offset`,
            `${trackOptionsMap[beaconTrackId].options.z}`
        ]
    })

    trackOptionsMap['ab018f191c70470f98ac3becb76e6d13'] = {
        function: createBassAnimation,
        options: {
            name: '07: Bass 1+2: Edited',
            meshesToColor: [
                mainTriangleInnerMesh
            ]
        }
    }

    trackOptionsMap['b0ba6f144fac4f668ba6981c691277d6'] = {
        function: createBassAnimation,
        options: {
            name: '08: Bass 1+2: Distant',
            baseScale: mainTrianglesOuterMeshScale,
            rotation: mainTrianglesOuterMeshRotationY,
            meshesToColor: [
                mainTriangleOuterMesh,
                outerMainTriangleInnerMesh
            ]
        }
    }

    trackOptionsMap[rim1TrackId] = {
        function: createRimArpAnimation,
        options: {
            name: '09: Rim 1: Hi Arp',
            mesh: SHARED.Rim1HiArpMesh,
            color: Color.NeonGreen,
            meshesToColor: [
                mainTriangleOuterMesh,
                outerMainTriangleInnerMesh
            ],
            meshColorizationFactor: 0.01
        }
    }

    trackOptionsMap[rim2TrackId] = {
        function: createRimLineAnimation,
        options: {
            name: '10: Rim 2: Hi Line',
            mesh: SHARED.Rim2HiLineMesh,
            color: Color.NeonOrange,
            noteNumbers: [ 60, 62, 64, 65, 67, 69, 71, 72 ],
            meshesToColor: [
                mainTriangleOuterMesh,
                outerMainTriangleInnerMesh
            ],
            meshColorizationFactor: 0.02
        }
    }

    trackOptionsMap[rim3TrackId] = {
        function: createRimLineAnimation,
        options: {
            name: '11: Rim 3: Lo Line',
            mesh: SHARED.Rim3LoLineMesh,
            color: Color.NeonPurple,
            noteNumbers: [ 52, 53, 55, 57, 59, 60 ],
            meshesToColor: [
                mainTriangleOuterMesh,
                outerMainTriangleInnerMesh
            ],
            meshColorizationFactor: 0.02
        }
    }

    trackOptionsMap[flyer1TrackId] = {
        function: createFlyerAnimation,
        options: {
            name: '12: Flyer 1',
            color: Color.LightBrightRed,
        }
    }

    //#endregion

    //#region Audio engine setup

    const audioSelectionOverlay = document.getElementById(`initial-overlay`)
    audioSelectionOverlay!.style.display = `block`

    const hideLoadingUI = engine.hideLoadingUI
    engine.hideLoadingUI = () => {}

    const loadingElement = document.getElementById("babylonjsLoadingDiv")
    const loadingElementDisplayStyle = loadingElement.style.display
    loadingElement.style.display = "none"
    loadingElement.style.opacity = "0.75"

    const loadAudio = (engineName: string) => {
        audioSelectionOverlay!.style.display = `none`
        loadingElement.style.display = loadingElementDisplayStyle

        const script = document.createElement(`script`)
        script.src = `./audio-${engineName}.js`
        script.addEventListener(`load`, (e) => {
            console.debug(`${script.src} loading - done`)
            audioEngine = new AUDIO.Engine(BABYLON.Engine.audioEngine!.audioContext)
            audioEngine.readyObservable.addOnce(() => {
                audioEngine.onCameraMatrixChanged(camera.matrix)
                engine.hideLoadingUI = hideLoadingUI
                engine.hideLoadingUI()
            })
            camera.registerOnMatrixChanged(audioEngine.onCameraMatrixChanged)

            let previousTime = 0
            let time = -1
            scene.registerBeforeRender(() => {
                previousTime = time
                time = audioEngine.sequenceTime
                world.run(time, time - previousTime)
            })
        })
        console.debug(`${script.src} loading ...`)
        document.body.appendChild(script)
    }

    if (UrlParams.get(`audioEngine`) === `daw`) {
        const oscScript = document.createElement('script')
        oscScript.src = "https://unpkg.com/osc-js@2.3.0/lib/osc.min.js"
        console.debug(`OSC script loading ...`)
        oscScript.addEventListener(`load`, () => {
            console.debug(`OSC script loading - done`)
            global.javascriptScoreLines = javascriptScoreLines
            loadAudio(`daw`)
        })
        document.body.appendChild(oscScript)
    }
    else {
        const audio3dofButton = document.getElementById(`audio-3dof-button`)
        const audio6dofButton = document.getElementById(`audio-6dof-button`)

        audio3dofButton.onclick = () => {
            console.debug(`audio 3dof button clicked`)
            camera.lockPosition()

            const omnitoneScript = document.createElement('script')
            omnitoneScript.src = "https://www.gstatic.com/external_hosted/omnitone/build/omnitone.min.js"
            console.debug(`Omnitone script loading ...`)
            omnitoneScript.addEventListener(`load`, () => {
                console.debug(`Omnitone script loading - done`)
                loadAudio(`3dof`)
            })
            document.body.appendChild(omnitoneScript)
        }

        audio6dofButton.onclick = () => {
            console.debug(`audio 6dof button clicked`)
            loadAudio(`6dof`)
        }
    }

    let audioEngine: AUDIO.Engine = null

    //#endregion

    //#region World initialization

    const csdData = csdJson
    const csdDataUuids = Object.keys(csdData)
    for (let i = 0; i < csdDataUuids.length; i++) {
        const id = csdDataUuids[i]
        // Importing the .json file brings in an object key named 'default' for some reason. Skip it.
        if (id === 'default') {
            continue
        }
        if (trackOptionsMap[id]) {
            const trackEntity = trackOptionsMap[id].function(id, csdData[id], trackOptionsMap[id].options)
            world.add(trackEntity)
        }
        else {
            console.warn(`No create track function found for id ${id}.`)
        }
    }

    world.build()

    //#endregion

    //#region A+A

    const aaMesh = makeBottomlessTrianglePolygonMeshWithUvs()
    aaMesh.rotation.set(0, Math.PI * 0.333, 0)
    aaMesh.scaling.set(10, 5, 10)
    aaMesh.position.set(0, 0, -400)
    aaMesh.isVisible = true
    const aaTexture = createSvgTexture(`
        <svg width="2048" height="1761" viewBox="0 0 541.867 465.931" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1.3483 0 0 1.32874 201.46 175.182)"><g style="line-height:1;text-align:center" font-size="33.867" text-anchor="middle" fill="#fff" stroke-width="1.058" font-weight="700"><path d="M64.375-68.636H57.81l-1.703-4.978H46.98l-1.703 4.978h-6.4l9.095-24.623h7.31zm-9.806-9.492-3.026-8.83-3.026 8.83zm6.466 43.358h-5.986v-9.21q0-1.125-.116-2.233-.116-1.124-.397-1.654-.33-.611-.975-.893-.629-.28-1.77-.28-.81 0-1.653.264-.827.264-1.803.843v13.163h-5.953v-18.57h5.953v2.05q1.588-1.24 3.043-1.901 1.471-.662 3.257-.662 3.01 0 4.697 1.753 1.703 1.753 1.703 5.242zM60.671-.903h-5.953v-1.935Q53.18-1.581 51.841-.986q-1.34.595-3.093.595-3.39 0-5.423-2.612-2.034-2.613-2.034-7.045 0-2.365.678-4.184.694-1.835 1.885-3.141 1.124-1.24 2.728-1.919 1.604-.694 3.208-.694 1.67 0 2.729.364 1.075.347 2.2.893v-7.905h5.952zM54.718-6.03v-9.112q-.628-.265-1.323-.38-.694-.116-1.273-.116-2.348 0-3.522 1.472-1.174 1.455-1.174 4.051 0 2.729.942 3.969.943 1.223 3.026 1.223.81 0 1.72-.297.91-.314 1.604-.81zm-2.894 32.428 4.234-12.005h6.118L51.857 39.776h-6.449l2.944-6.945-7.227-18.438h6.25z" style="-inkscape-font-specification:'sans-serif, Bold'" aria-label="A nd y"/></g><path d="M-87.66 209.376h-6.564l-1.703-4.977h-9.128l-1.704 4.977h-6.4l9.096-24.623h7.309zm-9.805-9.492-3.026-8.83-3.026 8.83zm70.941 9.492h-6.317V192.89l-4.564 10.7h-4.382l-4.564-10.7v16.487h-5.986v-24.623h7.375l5.54 12.353 5.523-12.353h7.375zm60.772 0h-6.565l-1.704-4.977h-9.128l-1.703 4.977h-6.4l9.095-24.623h7.31zm-9.807-9.492-3.026-8.83-3.026 8.83zm67.519 9.492h-6.12l-10.45-16.9v16.9h-5.822v-24.623h7.59l8.98 14.106v-14.106h5.82zm61.333-12.286q0 3.44-1.57 6.168-1.571 2.712-3.97 4.167-1.802 1.091-3.951 1.521-2.15.43-5.094.43h-8.681v-24.623h8.93q3.009 0 5.192.513 2.183.496 3.67 1.422 2.547 1.555 4.003 4.2 1.471 2.63 1.471 6.202zm-6.565-.05q0-2.43-.892-4.15-.877-1.737-2.795-2.713-.976-.48-2.001-.645-1.009-.182-3.06-.182h-1.603v15.412h1.604q2.265 0 3.324-.198 1.058-.215 2.067-.76 1.736-.993 2.546-2.647.81-1.67.81-4.117zm65.915 12.336h-6.565l-1.703-4.977h-9.129l-1.703 4.977h-6.4l9.096-24.623h7.309zm-9.806-9.492-3.027-8.83-3.026 8.83z" aria-label="AMANDA" style="line-height:1.25;-inkscape-font-specification:'sans-serif Bold';text-align:center" font-weight="700" font-size="33.867" letter-spacing="31.75" text-anchor="middle" fill="#fff"/><path d="M125.15 91.482H-23.017v5.292c-.094 47.632 74.083 79.375 74.083 79.375s74.18-31.743 74.084-79.375z" fill="red"/><circle cx="14.025" cy="91.386" r="37.042" fill="red"/><circle cx="88.108" cy="91.61" r="37.042" fill="red"/><path d="m51.526-130.703 200.03 348.978-400.062.003z" fill="none" stroke="gray" stroke-width="1.058"/></g></svg>
    `)
    const aaMaterial = new BABYLON.StandardMaterial('', scene)
    aaMaterial.emissiveColor.set(1, 1, 1)
    aaMaterial.ambientTexture = aaTexture
    aaMaterial.disableLighting = true
    aaMesh.material = aaMaterial

    //#endregion

    const meshes = scene.meshes
    for (let i = 0; i < meshes.length; i++) {
        meshes[i].isPickable = false
    }

    return scene
}}

//#region class Project

export class Project {
    public static CreateScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement): BABYLON.Scene {
        return Playground.CreateScene(engine, canvas)
    }
}

 //#endregion
