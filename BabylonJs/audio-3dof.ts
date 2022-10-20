import * as BABYLON from "babylonjs"
import Omnitone from 'omnitone'

const HalfPi = Math.PI / 2
const StartTimeOffset = -0.95

class AudioEngine {
    constructor(audioContext) {
        audioContext.resume()
        audioContext.suspend()

        const options: BABYLON.ISoundOptions = {
            autoplay: false,
            loop: false,
            spatialSound: false,
            streaming: true
        }
        const audioWY = new BABYLON.Sound(`normalized-wy`, `./assets/normalized-wy.mp3`, null, null, options)
        const audioZX = new BABYLON.Sound(`normalized-zx`, `./assets/normalized-zx.mp3`, null, null, options)

        audioWY.play()
        audioWY.stop()
        audioZX.play()
        audioZX.stop()

        const foaRenderer = Omnitone.createFOARenderer(audioContext)
        foaRenderer.initialize().then(() => {
            audioContext.suspend()
            const channelMerger = new ChannelMergerNode(audioContext, {
                numberOfInputs: 4,
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'discrete'
            })
            const gainNodeWY = audioWY.getSoundGain()
            const gainNodeZX = audioZX.getSoundGain()
            gainNodeWY.disconnect()
            gainNodeWY.connect(channelMerger, 0, 0)
            gainNodeWY.connect(channelMerger, 0, 1)
            gainNodeZX.disconnect()
            gainNodeZX.connect(channelMerger, 0, 3)
            gainNodeZX.connect(channelMerger, 0, 2)
            channelMerger.connect(foaRenderer.input)
            foaRenderer.output.connect(audioContext.destination)
            foaRenderer.setRotationMatrix4(this._.rotationMatrix.m)

            const intervalId = setInterval(() => {
                if (audioWY.isReady() && audioZX.isReady()) {
                    clearInterval(intervalId)
                    audioContext.suspend()
                    audioWY.play()
                    audioZX.play()
                    this._.startTime = audioContext.currentTime
                    audioContext.resume()
                    this.readyObservable.notifyObservers()
                }
            })
        })

        const tickMs = 0.1
        const maxRotationAmountPerTick = 0.01
        let rotationInitialized = false
        setInterval(() => {
            if (Math.abs(this._.adjustedRotationTargetY - this._.rotationY) < maxRotationAmountPerTick) {
                return
            }
            if (!rotationInitialized) {
                rotationInitialized = true
                this._.rotationY = this._.adjustedRotationTargetY
            }
            if (this._.adjustedRotationTargetY < this._.rotationY) {
                this._.rotationY -= maxRotationAmountPerTick
            }
            else if (this._.rotationY < this._.adjustedRotationTargetY) {
                this._.rotationY += maxRotationAmountPerTick
            }
            if (foaRenderer) {
                BABYLON.Matrix.RotationYToRef(this._.rotationY, this._.rotationMatrix)
                foaRenderer.setRotationMatrix4(this._.rotationMatrix.m)
            }
        }, tickMs)

        audioWY.onEndedObservable.add(this.onAudioEnded)
        audioZX.onEndedObservable.add(this.onAudioEnded)

        this._.audioContext = audioContext
        this._.audioWY = audioWY
        this._.audioZX = audioZX
    }

    public onCameraMatrixChanged = (matrix: BABYLON.Matrix): void => {
        matrix.decompose(undefined, this._.cameraRotationQuaternion)
        this._.cameraRotationQuaternion.toEulerAnglesToRef(this._.cameraRotation)
        this.rotationY = this._.cameraRotation.y
    }

    public get sequenceTime(): number {
        return this._.audioWY.isPlaying ? (this._.audioContext.currentTime - this._.startTime) - StartTimeOffset : 0
    }

    public readyObservable = new BABYLON.Observable<void>()

    private set rotationY(value: number) {
        if (0.01 < Math.abs(this._.rotationTargetY - value)) {
            this._.rotationTargetY = value
            this._.adjustedRotationTargetY = value - HalfPi
        }
    }

    private onAudioEnded = () => {
        if (!this._.audioWY.isPlaying && !this._.audioZX.isPlaying) {
            console.debug(`Restarting audio`)
            this._.audioContext.suspend()
            this._.audioWY.play()
            this._.audioZX.play()
            this._.startTime = this._.audioContext.currentTime
            this._.audioContext.resume()
        }
    }

    private _ = new class Private {
        audioContext = null
        audioWY: BABYLON.Sound = null
        audioZX: BABYLON.Sound = null
        cameraRotationQuaternion = new BABYLON.Quaternion
        cameraRotation = new BABYLON.Vector3
        rotationTargetY: number = 0
        adjustedRotationTargetY: number = 0
        rotationY: number = 0
        rotationMatrix = new BABYLON.Matrix
        startTime: number = 0
    }
}

global.AUDIO = {
    Engine: AudioEngine
}
