var os = require('os');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound');
    const buildDir = csoundDir + '/build/playback';
    spawnSync('bash', [ '-c', 'cmake -B ' + buildDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON' ], {
        stdio: 'inherit'
    });
    spawnSync('bash', [ '-c', 'cd ' + buildDir + ' && make 2>&1' ], {
        stdio: 'inherit'
    });
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
