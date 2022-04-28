const OSC = require('osc-js')

// Reloading the web-page causes a websocket exception. Catch it and do nothing to keep OSC bridge running.
process.on('uncaughtException', err => {
    if (!err.toString().startsWith('Error: WebSocket is not open: ')) {
        console.error(err)
    }
})

// UDP server host and port must match definitions.h BROWSER_OSC_ADDRESS, BROWSER_OSC_CLIENT_PORT, and
// BROWSER_OSC_SERVER_PORT.
const config = { udpServer: { host: '127.0.0.1', port: 9129 }, udpClient: { host: '127.0.0.1', port: 9130 } }
const osc = new OSC({ plugin: new OSC.BridgePlugin(config) })
osc.open()

console.log('OSC UDP/WebSocket bridge started.')
console.log('OSC messages sent from UDP 127.0.0.1:9129 will be routed to websocket localhost:8080')
console.log('OSC messages sent from websocket localhost:8080 will be routed to UDP 127.0.0.1:9130')
