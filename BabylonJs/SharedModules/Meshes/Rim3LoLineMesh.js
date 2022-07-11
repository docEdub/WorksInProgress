
class Rim3LoLineMesh {
    scaling = 2
    y = 200
    segments = 240
    rows = 6
    segmentRadius = 400
    segmentCenterY = 250
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

    _private = {
        audioPositions: null,
        vertexPositions: null,
        vertexIndices: null,
        audioPositionsString: null
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

            // Calculate audio positions.
            if (rowIndex < this.rows) {
                const rowCenterAngle = rowAngle + (this.rowAngle / 2) / 180 * Math.PI
                const rowCenterY =
                    this.scaling
                    * (Math.sin(rowCenterAngle) * this.segmentRadius + this.segmentCenterY)
                    + this.y
                for (let segmentIndex = 0; segmentIndex < segmentsD2; segmentIndex++) {
                    const segmentCenterAngleA = segmentIndex * segmentAngleIncrement + segmentAngleOffset
                    const positionXA = Math.cos(segmentCenterAngleA) * positionRadius
                    const positionZA = Math.sin(segmentCenterAngleA) * positionRadius
                    this._private.audioPositions.push(this.scaling * positionXA, rowCenterY, this.scaling * positionZA)

                    const segmentCenterAngleB = segmentCenterAngleA + segmentAngleIncrement / 2
                    const positionXB = Math.cos(segmentCenterAngleB) * positionRadius
                    const positionZB = Math.sin(segmentCenterAngleB) * positionRadius
                    this._private.audioPositions.push(this.scaling * positionXB, rowCenterY, this.scaling * positionZB)
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

module.exports = new Rim3LoLineMesh
