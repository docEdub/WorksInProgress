const OSC = require('osc-js')

// UDP server host and port must match definitions.h BROWSER_OSC_ADDRESS and BROWSER_OSC_PORT.
const config = { udpServer: { host: '127.0.0.1', port: 9129 } }

const osc = new OSC({ plugin: new OSC.BridgePlugin(config) })
osc.open()

// Reloading the web-page causes a websocket exception. Catch it and do nothing.
process.on('uncaughtException', err => {
    console.error(err)
})

console.log('OSC UDP to WebSocket bridge started.')
console.log('OSC messages sent from Csound to 127.0.0.1:9129 will be routed to a osc-js websocket client on port 8080.')
