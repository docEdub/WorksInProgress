const BABYLON = require('babylonjs')

class MainCameraArray {
    get length() {
        return this._.cameras.length
    }

    get matrixes() {
        if (!this._.matrixes) {
            const matrixes = []
            for (let i = 0; i < this.length; i++) {
                matrixes.push(...this.getCameraMatrixAsArray(i))
            }
            this._.matrixes = matrixes
        }
        return this._.matrixes
    }

    get matrixesString() {
        if (!this._.matrixesString) {
            const matrixes = this.matrixes
            let s = `${matrixes.length}`
            for (let i = 0; i < matrixes.length; i++) {
                s += `\ngiMainCameraArrayMatrixes[${i}] = ${matrixes[i].toFixed(3)}`
            }
            this._.matrixesString = s
        }
        return this._.matrixesString
    }

    getCamera = (cameraIndex) => {
        return this._.getCamera(cameraIndex)
    }

    getCameraMatrixAsArray = (cameraIndex) => {
        const camera = this.getCamera(cameraIndex)
        camera.computeWorldMatrix()
        return camera.getWorldMatrix().m
    }

    _ = new class {
        constructor() {
            for (let i = 0; i < this.cameras.length; i++) {
                this.cameras[i] = null
            }
        }

        engine = null
        scene = null
        cameras = new Array(1)
        matrixes = null
        matrixesString = null

        createCamera = (index, position, target) => {
            if (!this.engine) {
                this.engine = BABYLON.Engine.LastCreatedEngine
            }
            if (!this.engine) {
                this.engine = new BABYLON.NullEngine
            }
            if (!this.scene) {
                this.scene = BABYLON.Engine.LastCreatedScene
            }
            if (!this.scene) {
                this.scene = new BABYLON.Scene(this.engine)
            }
            const camera = new BABYLON.FreeCamera(``, position, null)
            camera.setTarget(target)
            this.cameras[index] = camera
        }

        getCamera = (cameraIndex) => {
            if (!this.cameras[cameraIndex]) {
                switch(cameraIndex) {
                case 0:
                    this.createCamera(0, new BABYLON.Vector3(0, 2, -100), new BABYLON.Vector3(0, 2, 0))
                    break
                }
            }
            return this.cameras[cameraIndex]
        }
    }
}

module.exports = new MainCameraArray
