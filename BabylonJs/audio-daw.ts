import * as BABYLON from "babylonjs"

//#region OSC declarations

declare global {
    class OSC {
        constructor()
        constructor(args)
        on: any
        open: any
        send: any
        status: any
    }

    namespace OSC {
        class Message {
            constructor(address)
            constructor(address, ...args)
            add(any)
        }
        class WebsocketClientPlugin {
            constructor(args)
        }
        class WebsocketServerPlugin {
            constructor(args)
        }
    }
}

const OSC_STATUS = {
    IS_NOT_INITIALIZED: -1,
    IS_CONNECTING: 0,
    IS_OPEN: 1,
    IS_CLOSING: 2,
    IS_CLOSED: 3
}

//#endregion

class AudioEngine {
    constructor() {
        const clientPlugin = new OSC.WebsocketClientPlugin({ port: 8080 })
        const clientOsc = new OSC({ plugin: clientPlugin })
        let heartbeatCount = 0
        let previousHeartbeatCount = 0
        let missedHeartbeatCount = 0
        let heartbeatIsActive = false
        clientOsc.on('/daw/heartbeat', message => {
            //console.debug(`daw heartbeat received`)
            heartbeatCount += 1
        })
        setInterval(() => {
            if (previousHeartbeatCount != heartbeatCount) {
                previousHeartbeatCount = heartbeatCount
                missedHeartbeatCount = 0
                if (!heartbeatIsActive) {
                    heartbeatIsActive = true
                    onHeartbeatActivated()
                }
            }
            else if (heartbeatIsActive) {
                missedHeartbeatCount += 1
                if (missedHeartbeatCount == 2) {
                    heartbeatIsActive = false
                    onHeartbeatDeactivated()
                }
            }
        }, 500)
        const onHeartbeatActivated = () => {
            console.debug("DAW heartbeat activated")
            sendJavascriptScoreLinesViaOsc()
            // The heartbeat from the MasterHead plugin often arrives before other plugins are ready to receive
            // javascript score lines, so send the initial OSC messages to the DAW again after 5 seconds.
            // TODO: Send a plugin awake OSC message to Javascript so we know when to send the initial OSC messages.
            setTimeout(() => {
                sendJavascriptScoreLinesViaOsc()
            }, 5000)
        }
        const onHeartbeatDeactivated = () => {
            console.debug("DAW heartbeat deactivated")
        }
        clientOsc.on('/daw/time_in_seconds', message => {
            this._.currentTime = message.args[0] + 3.5 // + 3.5 for score start delay
        })
        console.debug("Opening OSC client")
        clientOsc.open()
        this._.oscServer = new OSC()
        console.debug("Opening OSC server")
        this._.oscServer.open()
        setInterval(() => {
            if (clientOsc.status() == OSC_STATUS.IS_CLOSED) {
                console.debug("Re-openinig OSC client")
                this._.oscServer.open()
            }
            if (this._.oscServer.status() == OSC_STATUS.IS_CLOSED) {
                console.debug("Re-openinig OSC server")
                this._.oscServer.open()
                sendJavascriptScoreLinesViaOsc()
            }
        }, 1000)

        const sendJavascriptScoreLinesViaOsc = () => {
            if (this._.oscServer.status() !== OSC_STATUS.IS_OPEN) {
                setTimeout(sendJavascriptScoreLinesViaOsc, 10)
                return
            }

            this.updateDawCameraMatrix(this._.pendingCameraMatrix)

            console.debug(`Sending JavaScript score lines via OSC ...`)
            for (let i = 0; i < global.javascriptScoreLines.length; i++) {
                const scoreLine = global.javascriptScoreLines[i]
                if (scoreLine.oscMessage === undefined) {
                    const message = new OSC.Message('/DawService/javascript_score_line')
                    message.add(scoreLine.trackId)
                    for (let j = 0; j < scoreLine.parameters.length; j++) {
                        const parameter = scoreLine.parameters[j]
                        message.add(parameter)
                    }
                    scoreLine.oscMessage = message
                }
                this._.oscServer.send(scoreLine.oscMessage)
            }
        }
    }

    public onCameraMatrixChanged = (matrix: BABYLON.Matrix): void => {
        this._.pendingCameraMatrix.copyFrom(matrix)
        if (this._.oscServer.status() === OSC_STATUS.IS_OPEN) {
            this.updateDawCameraMatrix(matrix)
        }
    }

    public get sequenceTime(): number {
        return this._.currentTime
    }

    private updateDawCameraMatrix = (matrix: BABYLON.Matrix): void => {
        const message = new OSC.Message('/DawService/camera_matrix')
        for (let i = 0; i < 16; i++) {
            message.add(matrix.m[i])
        }
        this._.oscServer.send(message)
    }

    private _ = new class Private {
        currentTime = 0
        oscServer: OSC = null
        pendingCameraMatrix = new BABYLON.Matrix
        hasPendingCameraMatrixChange = false
    }
}

global.AUDIO = {
    Engine: AudioEngine
}
