
const BABYLON = require('babylonjs')

class RimMesh {
    scaling = 1
    y = 1
    segments = 100
    rows = 10
    segmentRadius = 100
    segmentCenterY = 100
    rowAngle = 1 // degrees

    get audioPositions() {
        this.#init()
        return this._private.audioPositions
    }

    get vertexPositions() {
        this.#init()
        return this._private.vertexPositions
    }

    get vertexIndices() {
        this.#init()
        return this._private.vertexIndices
    }

    get audioPositionsString() {
        this.#init()
        return this._private.audioPositionsString
    }

    get faceMatrices() {
        this.#init()
        return this._private.faceMatrices
    }

    _private = {
        audioPositions: null,
        vertexPositions: null,
        vertexIndices: null,
        audioPositionsString: null,
        faceMatrices: []
    }

    #init = () => {
        if (this._private.audioPositions) {
            return
        }

        this._private.audioPositions = []
        this._private.vertexPositions = []
        this._private.vertexIndices = []

        const segmentsD2 = this.segments / 2
        const angleToGround = -Math.asin(this.segmentCenterY / this.segmentRadius)
        const groundRadius =  Math.cos(angleToGround) * this.segmentRadius
        const segmentAngleIncrement = 2 * Math.PI / segmentsD2

        // Calculate vertex positions and audio positions.
        for (let rowIndex = 0; rowIndex <= this.rows; rowIndex++) {

            // Calculate vertex positions.
            const rowAngle = angleToGround + rowIndex * this.rowAngle / 180 * Math.PI
            const positionY = Math.sin(rowAngle) * this.segmentRadius + this.segmentCenterY
            let positionRadius = Math.cos(rowAngle) * this.segmentRadius
            positionRadius = groundRadius - (positionRadius - groundRadius)
            const segmentAngleOffset = rowIndex * segmentAngleIncrement / 2
            for (let segmentIndex = 0; segmentIndex < segmentsD2; segmentIndex++) {
                const segmentAngle = segmentIndex * segmentAngleIncrement + segmentAngleOffset
                const positionX = Math.cos(segmentAngle) * positionRadius
                const positionZ = Math.sin(segmentAngle) * positionRadius
                this._private.vertexPositions.push(
                    this.scaling * positionX,
                    this.scaling * positionY + this.y,
                    this.scaling * positionZ
                )
            }

            // Calculate audio positions and face matrices.
            if (rowIndex < this.rows) {
                const rowCenterAngle = rowAngle + (this.rowAngle / 2) / 180 * Math.PI
                const rowCenterY =
                    this.scaling
                    * (Math.sin(rowCenterAngle) * this.segmentRadius + this.segmentCenterY)
                    + this.y

                const upVectorAngle = rowCenterAngle + (this.rowAngle / 2) / 180 * Math.PI
                const upVectorY =
                    this.scaling
                    * (Math.sin(upVectorAngle) * this.segmentRadius + this.segmentCenterY)
                    + this.y
                let upVectorRadius = Math.cos(upVectorAngle) * this.segmentRadius
                upVectorRadius = groundRadius - (upVectorRadius - groundRadius)

                const downVectorAngle = rowCenterAngle + (this.rowAngle / 2) / 180 * Math.PI
                const downVectorY =
                    this.scaling
                    * (Math.sin(downVectorAngle) * this.segmentRadius + this.segmentCenterY)
                    + this.y
                let downVectorRadius = Math.cos(downVectorAngle) * this.segmentRadius
                downVectorRadius = groundRadius - (downVectorRadius - groundRadius)

                for (let segmentIndex = 0; segmentIndex < segmentsD2; segmentIndex++) {
                    const segmentCenterAngleA = segmentIndex * segmentAngleIncrement + segmentAngleOffset
                    const positionXA = this.scaling * Math.cos(segmentCenterAngleA) * positionRadius
                    const positionZA = this.scaling * Math.sin(segmentCenterAngleA) * positionRadius
                    this._private.audioPositions.push(positionXA, rowCenterY, positionZA)

                    const upVectorXA = (this.scaling * Math.cos(segmentCenterAngleA) * upVectorRadius) - positionXA
                    const upVectorZA = (this.scaling * Math.sin(segmentCenterAngleA) * upVectorRadius) - positionZA
                    const faceMatrixA = BABYLON.Matrix.LookAtLH(
                        new BABYLON.Vector3(positionXA, rowCenterY, positionZA),
                        BABYLON.Vector3.ZeroReadOnly,
                        new BABYLON.Vector3(upVectorXA, upVectorY, upVectorZA)
                    )
                    const flippedFaceMatrixA =
                        faceMatrixA.getRotationMatrix()
                        * BABYLON.Matrix.RotationY(Math.PI)
                        * BABYLON.Matrix.Translation(positionXA, rowCenterY, positionZA)
                    this._private.faceMatrices.push(flippedFaceMatrixA)

                    const segmentCenterAngleB = segmentCenterAngleA + segmentAngleIncrement / 2
                    const positionXB = this.scaling * Math.cos(segmentCenterAngleB) * positionRadius
                    const positionZB = this.scaling * Math.sin(segmentCenterAngleB) * positionRadius
                    this._private.audioPositions.push(this.scaling * positionXB, rowCenterY, this.scaling * positionZB)

                    const upVectorXB = (this.scaling * Math.cos(segmentCenterAngleB) * downVectorRadius) - positionXB
                    const upVectorZB = (this.scaling * Math.sin(segmentCenterAngleB) * downVectorRadius) - positionZB
                    const faceMatrixB = BABYLON.Matrix.LookAtLH(
                        new BABYLON.Vector3(positionXB, rowCenterY, positionZB),
                        BABYLON.Vector3.ZeroReadOnly,
                        new BABYLON.Vector3(upVectorXB, downVectorY, upVectorZB)
                    )
                    const flippedFaceMatrixB =
                        faceMatrixB.getRotationMatrix()
                        * BABYLON.Matrix.RotationY(Math.PI)
                        * BABYLON.Matrix.Translation(positionXB, rowCenterY, positionZB)
                    this._private.faceMatrices.push(flippedFaceMatrixB)
                }
            }
        }

        // Calculate vertex indices.
        for (let rowIndex = 0; rowIndex < this.rows; rowIndex++) {
            const baseSegmentIndex = segmentsD2 * rowIndex
            for (let segmentIndex = 0; segmentIndex < segmentsD2; segmentIndex++) {
                let index1a = segmentIndex % segmentsD2
                let index2a = index1a - 1
                if (index2a < 0) {
                    index2a += segmentsD2
                }
                let index3a = index2a + segmentsD2
                this._private.vertexIndices.push(
                    index1a + baseSegmentIndex,
                    index2a + baseSegmentIndex,
                    index3a + baseSegmentIndex
                )

                let index1b = segmentIndex
                let index2b = index1b + segmentsD2 - 1
                if (index2b < segmentsD2) {
                    index2b += segmentsD2
                }
                let index3b = index1b + segmentsD2
                this._private.vertexIndices.push(
                    index1b + baseSegmentIndex,
                    index2b + baseSegmentIndex,
                    index3b + baseSegmentIndex
                )
            }
        }

        // Set audio position string.
        let s = `${this._private.audioPositions.length}`
        for (let i = 0; i < this._private.audioPositions.length; i++) {
            s +=  `\ngiSaw1RimSynth_MeshAudioPositions[${i}] =  ${this._private.audioPositions[i].toFixed(3)}`
        }
        this._private.audioPositionsString = s
    }
}

module.exports = RimMesh
