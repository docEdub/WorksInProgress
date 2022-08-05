var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;

const csoundDir = path.resolve('Csound');
const buildDir = path.join(csoundDir, 'build');

let command = null

if (os.type() === 'Darwin') {
    command = spawn('bash', [ '-c', 'cmake -B ' + buildDir + ' -S ' + csoundDir ], { stdio: 'inherit' });
}
else if (os.type() === 'Windows_NT') {
    command = spawn('cmd', [ '/c', 'cmake -B ' + buildDir + ' -S ' + csoundDir ], { stdio: 'inherit' });
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}

module.exports = {
    command: command
}
