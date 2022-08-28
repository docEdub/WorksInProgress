
const BABYLON = require('babylonjs')

class FlyerPath {
    height = 210 // center of main pyramid mesh's top piece
    segments = 60
    startRotation = 0 // degrees
    startRadius = 0
    radiusDelta = 9
    zDelta = 9
    segmentMilliseconds = 100

    get points() {
        this.#init()
        return this.#private.points
    }

    get pointsCounterClockwise() {
        this.#initCounterClockwise()
        return this.#private.pointsCounterClockwise
    }

    get audioPointsString() {
        this.#init()
        return this.#private.audioPointsString
    }

    get speedMultiplier() {
        return this.#private.speedMultiplier
    }

    #Private = class {
        get #public() {
            return this._public
        }

        constructor(this_public) {
            this._public = this_public

            this.points = null
            this.audioPointsString = null
            this.startRotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), this.#public.startRotation / 180 * Math.PI)
            this.speedMultiplier = 1000 / this.#public.segmentMilliseconds

            this.pointsCounterClockwise = null
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

    #extensionPoints = (endPoint, extensionVector) => {
        const points = []
        endPoint = endPoint.clone()
        for (let i = 0; i < 100; i++) {
            endPoint.addInPlace(extensionVector.scaleInPlace(1.05))
            points.push(endPoint.clone())
        }
        return points
    }

    #init = () => {
        if (this.#private.audioPoints) {
            return
        }

        const hiPoint = new BABYLON.Vector3(0, this.height, this.startRadius)
        const points = []
        points.push(...this.#spiralDescentPoints(hiPoint))
        const lowPoint = points[points.length - 1]
        points.push(...this.#spiralAscendPoints(lowPoint))
        points.push(...this.#extensionPoints(points[points.length - 1], points[points.length - 1].subtract(points[points.length - 2])))
        let zOffset = 0
        for (let i = 0; i < points.length; i++) {
            points[i].z += zOffset
            points[i].applyRotationQuaternionInPlace(this.#private.startRotationQuaternion)
            zOffset += this.zDelta
        }
        this.#private.points = points

        const audioPoints = []
        for (let i = 0; i < points.length; i++) {
            const point = points[i]
            audioPoints.push(point.x, point.y, point.z)
        }

        // Set audio point strings.
        let audioPointsString = `${audioPoints.length}`
        for (let i = 0; i < audioPoints.length; i++) {
            audioPointsString +=  `\ngiSaw2FlyerSynth_${this.constructor.name}AudioPoints[${i}] =  ${audioPoints[i].toFixed(3)}`
        }
        this.#private.audioPointsString = audioPointsString
    }

    #initCounterClockwise = () => {
        if (this.#private.pointsCounterClockwise) {
            return
        }

        this.#private.pointsCounterClockwise = [...this.points]
        for (let i = 0; i < this.#private.pointsCounterClockwise.length; i++) {
            this.#private.pointsCounterClockwise[i].z *= -1
        }
    }
}

module.exports = FlyerPath
