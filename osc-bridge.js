const OSC = require('osc-js')

// Reloading the web-page causes a websocket exception. Catch it and do nothing to keep OSC bridge running.
process.on('uncaughtException', err => {
    if (!err.toString().startsWith('Error: WebSocket is not open: ')) {
        console.error(err)
    }
})

// UDP server host and port must match definitions.h BROWSER_OSC_ADDRESS and BROWSER_OSC_PORT.
// const dawToBrowserConfig = { udpServer: { host: '127.0.0.1', port: 9129 } }
const browserToDawConfig = { udpServer: { host: '127.0.0.1', port: 9129 }, udpClient: { host: '127.0.0.1', port: 9130 } }

// const dawToBrowserOsc = new OSC({ plugin: new OSC.BridgePlugin(dawToBrowserConfig) })
// dawToBrowserOsc.open()

// console.log('')
// console.log('OSC UDP to WebSocket bridge started.')
// console.log('OSC messages sent from Csound to 127.0.0.1:9129 will be routed to a osc-js websocket client on port 8080.')

const browserToDawOsc = new OSC({ plugin: new OSC.BridgePlugin(browserToDawConfig) })
browserToDawOsc.open()

console.log('')
console.log('OSC WebSocket to UDP bridge started.')
console.log('OSC messages sent from an osc-js websocket server on port 8080 will be routed to Csound using host/port 127.0.0.1:9130.')
