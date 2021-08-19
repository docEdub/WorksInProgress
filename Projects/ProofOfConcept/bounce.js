var fs = require('fs')
var os = require('os');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound');
    const buildDir = csoundDir + '/build';
    const playbackDir = buildDir + '/playback';
    const bounceDir = buildDir + '/bounce';
    const jsonDir = bounceDir + '/json';
    spawnSync('bash', [ '-c', 'cmake -B ' + playbackDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON' ], {
        stdio: 'inherit'
    });
    spawnSync('bash', [ '-c', 'cd ' + playbackDir + ' && make 2>&1' ], {
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

    if (process.argv.indexOf('--with-json') != -1) {
        // NB: If the ~10000 max open file limit is hit on macOS, use `sudo launchctl limit maxfiles 655360 1048576` to
        // increase it.

        // Wipe the json folder.
        if (fs.existsSync(jsonDir)) {
            fs.rmdirSync(jsonDir, { recursive: true });
        }
        fs.mkdirSync(jsonDir);

        // Generate DawPlayback.json
        spawnSync('bash', [ '-c', 'cd ' + bounceDir + ' && csound DawPlayback.csd --omacro:IS_GENERATING_JSON=1 --smacro:IS_GENERATING_JSON=1' ], {
            stdio: 'inherit'
        });
    }
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
