
const BABYLON = require('babylonjs')

class FlyerPath {
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

    #init = () => {
        if (this.#private.audioPositions) {
            return
        }

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
