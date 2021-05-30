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

        // Remove "-+rtmidi=null" option.
        data = data.replace('-+rtmidi=null', '')

        // Remove Cabbage xml element.
        data = data.replace('<Cabbage>', '')
        data = data.replace('</Cabbage>', '')

        // Escape backslashes.
        data = data.replace(/\\/g, '\\\\');

        // Remove lines starting with "//"".
        data = data.replace(/\s*\/\/.*\n/g, '\n')

        // Remove lines starting with ";".
        data = data.replace(/\s*;.*\n/g, '\n')

        // Remove blank lines.
        data = data.replace(/\s*\n/g, '\n')

        // Add 8 spaces before each line.
        data = data.replace(/\n/g, '\n        ');

        // Wrap with Javascript multiline string variable named `csdText`.
        var output = '    const csdText = `' + data + '`\n'

        fs.writeFile(csoundDir + '/build/bounce/DawPlayback.csd.js', output, 'ascii', function (err) {
            if (err) {
                return console.log(err);
            }
            console.log('-- Generating ../bounce/DawPlayback.csd.js done')
        });
    });
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
