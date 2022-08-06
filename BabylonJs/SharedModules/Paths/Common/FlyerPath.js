
const BABYLON = require('babylonjs')

class FlyerPath {
    get path() {
        this.#init()
        return this.#private.path
    }

    get audioPositions() {
        this.#init()
        return this.#private.audioPositions
    }

    get audioPositionsString() {
        this.#init()
        return this.#private.audioPositionsString
    }

    #Private = class {
        get #public() {
            return this._public
        }

        constructor(this_public) {
            this._public = this_public

            this.path = null
            this.audioPositions = null
        }
    }
    _private = null
    get #private() {
        if (!this._private) {
            this._private = new this.#Private(this)
        }
        return this._private
    }

    #spiralDescentPoints = (startPoint) => {
        const points = []
        const pointCount = 360
        const yDelta = startPoint.y / 360
        const angleDelta = Math.PI / 180
        let angle = 0
        for (let i = 0; i <= pointCount; i++) {
            const point = BABYLON.Vector3.TransformCoordinates(startPoint, BABYLON.Matrix.RotationY(angle))
            point.y -= yDelta
            angle += angleDelta
            points.push(point)
        }
        return points
    }

    #init = () => {
        if (this.#private.audioPositions) {
            return
        }

        const startPoint = new BABYLON.Vector3(100, 100, 0)
        const points = this.#spiralDescentPoints(startPoint)
        this.#private.path = new BABYLON.Path3D(points)

        this.#private.audioPositions = [
            0, 0, 0
        ]

        // Set audio positions string.
        let s = `${this.#private.audioPositions.length}`
        for (let i = 0; i < this.#private.audioPositions.length; i++) {
            s +=  `\ngiSaw2FlyerSynth_PathAudioPositions[${i}] =  ${this.#private.audioPositions[i].toFixed(3)}`
        }
        this.#private.audioPositionsString = s
    }
}

module.exports = FlyerPath
