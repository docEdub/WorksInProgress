var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound');
    const buildDir = csoundDir + '/build';
    spawn('bash', [ '-c', 'cmake -B ' + buildDir + ' -S ' + csoundDir ], { stdio: 'inherit' });
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
