var fs = require('fs')
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

    // Save DawPlayback.csd as DawPlayback.js.csd with all backslashes converted for use as Javascript multiline string.
    fs.readFile(csoundDir + '/build/bounce/DawPlayback.csd', 'ascii', function (err, data) {
        if (err) {
            return console.log(err);
        }
        var result = data.replace(/\\/g, '\\\\');

        fs.writeFile(csoundDir + '/build/bounce/DawPlayback.js.csd', result, 'ascii', function (err) {
            if (err) {
                return console.log(err);
            }
            console.log('-- Generating ../bounce/DawPlayback.js.csd done')
        });
    });
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
