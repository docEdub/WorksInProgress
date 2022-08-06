
const BABYLON = require('babylonjs')

class RimMesh {
    scaling = 1
    y = 1
    rows = 10
    rowAngle = 1 // degrees
    segments = 100
    segmentRadius = 100
    segmentCenterY = 100

    get audioPositions() {
        this.#init()
        return this.#private.audioPositions
    }

    get vertexPositions() {
        this.#init()
        return this.#private.vertexPositions
    }

    get vertexIndices() {
        this.#init()
        return this.#private.vertexIndices
    }

    get audioPositionsString() {
        this.#init()
        return this.#private.audioPositionsString
    }

    get faceMatrices() {
        this.#init()
        return this.#private.faceMatrices
    }



    #Private = class {
        get #public() {
            return this._public
        }

        constructor(this_public) {
            this._public = this_public

            this.audioPositions = null
            this.vertexPositions = null
            this.vertexIndices = null
            this.audioPositionsString = null
            this.faceMatrices = []

            this.angleToGround = -Math.asin(this.#public.segmentCenterY / this.#public.segmentRadius)
            this.rowAngleIncrement = this.#public.rowAngle / 180 * Math.PI
            this.rowAngleIncrementD2 = this.rowAngleIncrement / 2
            this.segmentsD2 = this.#public.segments / 2
            this.segmentAngleIncrement = 2 * Math.PI / this.segmentsD2
            this.segmentAngleIncrementD2 = this.segmentAngleIncrement / 2
            this.tubeCenterRadius = this.#public.segmentRadius * 2
        }
    }
    _private = null
    get #private() {
        if (!this._private) {
            this._private = new this.#Private(this)
        }
        return this._private
    }

    #getRowVertexStartVector = (rowIndex) => {
        const vertexAngle = this.#private.angleToGround + rowIndex * this.#private.rowAngleIncrement

        let x = Math.cos(vertexAngle) * this.segmentRadius
        let y = Math.sin(vertexAngle) * this.segmentRadius
        let z = x * Math.tan(this.#private.segmentAngleIncrementD2)

        x -= this.#private.tubeCenterRadius
        y += this.segmentCenterY

        x *= this.scaling
        y *= this.scaling
        z *= this.scaling

        y += this.y

        return new BABYLON.Vector3(x, y, z)
    }

    #getRowCenterStartVector = (rowIndex) => {
        const vertexAngle = this.#private.angleToGround + rowIndex * this.#private.rowAngleIncrement

        let x = Math.cos(vertexAngle) * this.segmentRadius
        let y = Math.sin(vertexAngle) * this.segmentRadius

        x -= this.#private.tubeCenterRadius
        y += this.segmentCenterY

        x *= this.scaling
        y *= this.scaling

        return new BABYLON.Vector3(x, y, 0)
    }

    #getRowFaceStartMatrix = (rowIndex, xRotationXform) => {
        const vertexAngleX = this.#private.angleToGround + rowIndex * this.#private.rowAngleIncrement
        const vertexAngleY = vertexAngleX + this.#private.rowAngleIncrement

        let x = Math.cos(vertexAngleX) * this.segmentRadius
        let xy = Math.sin(vertexAngleX) * this.segmentRadius
        let y = Math.sin(vertexAngleY) * this.segmentRadius
        let yx = Math.cos(vertexAngleY) * this.segmentRadius
        let z = x * Math.tan(this.#private.segmentAngleIncrementD2)

        x -= this.#private.tubeCenterRadius
        xy += this.segmentCenterY
        y += this.segmentCenterY
        yx -= this.#private.tubeCenterRadius

        x *= this.scaling
        xy *= this.scaling
        y *= this.scaling
        yx *= this.scaling
        z *= this.scaling

        let scaleXform = BABYLON.Matrix.Scaling(x - yx, y - xy, z)
        let translationXform = BABYLON.Matrix.Translation(x, xy + this.y, 0)

        return scaleXform
            // .multiply(xRotationXform)
            .multiply(translationXform)
    }

    #init = () => {
        if (this.#private.audioPositions) {
            return
        }

        this.#private.audioPositions = []
        this.#private.vertexPositions = []
        this.#private.vertexIndices = []

        // Calculate row start vectors.
        const rowVertexStartVectors = []
        for (let rowIndex = 0; rowIndex <= this.rows; rowIndex++) {
            rowVertexStartVectors.push(this.#getRowVertexStartVector(rowIndex))
        }
        const rowCenterStartVectors = []
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            rowCenterStartVectors.push(this.#getRowCenterStartVector(rowIndex))
        }

        // Calculate face up and down start matrices.
        const faceUpStartMatrices = []
        const faceDownStartMatrices = []
        const xRotationMatrixForFaceUp = BABYLON.Matrix.RotationX(0)
        const xRotationMatrixForFaceDown = BABYLON.Matrix.RotationX(Math.PI)
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            faceUpStartMatrices.push(this.#getRowFaceStartMatrix(rowIndex, xRotationMatrixForFaceUp))
            // faceDownStartMatrices.push(this.#getRowFaceStartMatrix(rowIndex, xRotationMatrixForFaceDown))
        }

        // Calculate vertex positions.
        const rowSegmentVertexPositions = []
        for (let rowIndex = 0; rowIndex <= this.rows; rowIndex++) {
            const startPosition = rowVertexStartVectors[rowIndex]
            const segmentVertexPositions = []
            let segmentAngle = rowIndex * this.#private.segmentAngleIncrementD2
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                const xform = BABYLON.Matrix.RotationY(segmentAngle)
                segmentVertexPositions.push(BABYLON.Vector3.TransformCoordinates(startPosition, xform))
                segmentAngle += this.#private.segmentAngleIncrement
            }
            rowSegmentVertexPositions.push(segmentVertexPositions)
        }

        // Calculate audio positions.
        const rowSegmentAudioPositions = []
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            const startPosition = rowCenterStartVectors[rowIndex]
            const segmentAudioPositions = []
            let segmentAngle = 0
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                const yXformUp = BABYLON.Matrix.RotationY(segmentAngle)
                segmentAudioPositions.push(BABYLON.Vector3.TransformCoordinates(startPosition, yXformUp))
                segmentAngle += this.#private.segmentAngleIncrementD2
                // const yXformDown = BABYLON.Matrix.RotationY(segmentAngle)
                // segmentAudioPositions.push(BABYLON.Vector3.TransformCoordinates(startPosition, yXformDown))
                segmentAngle += this.#private.segmentAngleIncrementD2
            }
            rowSegmentAudioPositions.push(segmentAudioPositions)
        }

        // Calculate face matrices.
        const rowSegmentFaceMatrices = []
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            const faceUpStartMatrix = faceUpStartMatrices[rowIndex]
            const faceDownStartMatrix = faceDownStartMatrices[rowIndex]
            const segmentFaceMatrices = []
            let segmentAngle = rowIndex * this.#private.segmentAngleIncrementD2
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                const yXformUp = BABYLON.Matrix.RotationY(segmentAngle)
                segmentFaceMatrices.push(faceUpStartMatrix.multiply(yXformUp))
                segmentAngle += this.#private.segmentAngleIncrementD2
                // const yXformDown = BABYLON.Matrix.RotationY(segmentAngle)
                // segmentFaceMatrices.push(faceDownStartMatrix.multiply(yXformDown))
                segmentAngle += this.#private.segmentAngleIncrementD2
            }
            rowSegmentFaceMatrices.push(segmentFaceMatrices)
        }

        // Flatten vertex positions.
        for (let rowIndex = 0; rowIndex <= this.rows; rowIndex++) {
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                const position = rowSegmentVertexPositions[rowIndex][segmentIndex]
                this.#private.vertexPositions.push(position.x, position.y, position.z)
            }
        }

        // Flatten audio positions.
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                const position = rowSegmentAudioPositions[rowIndex][segmentIndex]
                this.#private.audioPositions.push(position.x, position.y, position.z)
            }
        }

        // Flatten face matrices.
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                const matrix = rowSegmentFaceMatrices[rowIndex][segmentIndex]
                // this.#private.faceMatrices.push(matrix.asArray())
                this.#private.faceMatrices.push(matrix)
            }
        }

        // Calculate vertex indices.
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            const baseSegmentIndex = this.#private.segmentsD2 * rowIndex
            for (let segmentIndex = 0; segmentIndex < this.#private.segmentsD2; segmentIndex++) {
                let index1a = segmentIndex % this.#private.segmentsD2
                let index2a = index1a - 1
                if (index2a < 0) {
                    index2a += this.#private.segmentsD2
                }
                let index3a = index2a + this.#private.segmentsD2
                this.#private.vertexIndices.push(
                    index1a + baseSegmentIndex,
                    index2a + baseSegmentIndex,
                    index3a + baseSegmentIndex
                )

                let index1b = segmentIndex
                let index2b = index1b + this.#private.segmentsD2 - 1
                if (index2b < this.#private.segmentsD2) {
                    index2b += this.#private.segmentsD2
                }
                let index3b = index1b + this.#private.segmentsD2
                this.#private.vertexIndices.push(
                    index1b + baseSegmentIndex,
                    index2b + baseSegmentIndex,
                    index3b + baseSegmentIndex
                )
            }
        }

        // Set audio positions string.
        let s = `${this.#private.audioPositions.length}`
        for (let i = 0; i < this.#private.audioPositions.length; i++) {
            s +=  `\ngiSaw1RimSynth_MeshAudioPositions[${i}] =  ${this.#private.audioPositions[i].toFixed(3)}`
        }
        this.#private.audioPositionsString = s
    }
}

module.exports = RimMesh
