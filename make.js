var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;

var configure = require('./configure')

const csoundDir = path.resolve('Csound')
const buildDir = path.join(csoundDir, '/build')

configure.command.on('close', (exitCode) => {
    if (os.type() === 'Darwin') {
        spawn('bash', [ '-c', 'cd ' + buildDir + ' && make ' + process.argv.slice(2).join(' ')], { stdio: 'inherit' })
    }
    else if (os.type() === 'Windows_NT') {
        spawn('cmd', [ '/c', 'cd ' + buildDir + ' && CMake --build . ' + process.argv.slice(2).join(' ')], { stdio: 'inherit' })
    }
    else {
        throw new Error('Unsupported OS: ' + os.type())
    }
})
