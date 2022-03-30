const OSC = require('osc-js')

const config = { udpServer: { host: '127.0.0.1', port: 9129 } }
const osc = new OSC({ plugin: new OSC.BridgePlugin(config) })

osc.open() // start a WebSocket server on port 8080
