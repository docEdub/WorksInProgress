
const BABYLON = require('babylonjs')

class FlyerPath {
    startRadius = 0
    height = 210 // center of main pyramid mesh's top piece
    segments = 120
    radiusDelta = 9

    get points() {
        this.#init()
        return this.#private.points
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

            this.points = null
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
        const yDelta = this.height / this.segments
        const angleDelta = Math.PI / (this.segments / 2)
        let referencePoint = new BABYLON.Vector3(0, startPoint.y, startPoint.z)
        let angle = 0
        for (let i = 0; i <= this.segments; i++) {
            const point = BABYLON.Vector3.TransformCoordinates(referencePoint, BABYLON.Matrix.RotationY(angle))
            points.push(point)
            referencePoint.z -= this.radiusDelta
            referencePoint.y -= Math.abs(Math.sin(angle)) * yDelta
            angle += angleDelta
        }
        return points
    }

    #spiralAscendPoints = (startPoint) => {
        const points = []
        const yDelta = this.height / this.segments
        const angleDelta = Math.PI / (this.segments / 2)
        let referencePoint = new BABYLON.Vector3(0, startPoint.y, startPoint.z)
        let angle = 0
        for (let i = 0; i < this.segments; i++) {
            referencePoint.z -= this.radiusDelta
            referencePoint.y += Math.abs(Math.sin(angle)) * yDelta
            angle += angleDelta
            const point = BABYLON.Vector3.TransformCoordinates(referencePoint, BABYLON.Matrix.RotationY(angle))
            points.push(point)
        }
        return points
    }

    #init = () => {
        if (this.#private.audioPositions) {
            return
        }

        const hiPoint = new BABYLON.Vector3(0, this.height, this.startRadius)
        const points = []
        points.push(...this.#spiralDescentPoints(hiPoint))
        const lowPoint = points[points.length - 1]
        points.push(...this.#spiralAscendPoints(lowPoint))
        // points.push(hiPoint)
        this.#private.points = points

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