var fs = require('fs')
var os = require('os');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound');
    const buildDir = csoundDir + '/build';
    const mixdownDir = buildDir + '/mixdown';
    const playbackDir = buildDir + '/playback';
    const bounceDir = buildDir + '/bounce';
    const jsonDir = bounceDir + '/json';
    const bounceMixdownDir = bounceDir + '/mixdown';
    const babylonJsDir = path.resolve('BabylonJs')

    spawnSync('bash', [ '-c', 'cmake -B ' + playbackDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON -D BUILD_MIXDOWN_CSD=OFF' ], {
        stdio: 'inherit'
    });
    spawnSync('bash', [ '-c', 'cd ' + playbackDir + ' && make 2>&1' ], {
        stdio: 'inherit'
    });

    // Save DawPlayback.csd as DawPlayback.js.csd with all backslashes converted for use as Javascript multiline string.
    let data = fs.readFileSync(csoundDir + '/build/bounce/DawPlayback.csd', 'ascii')

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

    // Replace leading whitespace with tabs.
    data = data.replace(/\n\s*/g, '\n\t')

    // Wrap with Javascript multiline string variable named `csdText`.
    let output = 'const csdText = `' + data + '`'
    
    // Update BabylonJs/project.ts csdText variable.
    data = fs.readFileSync(babylonJsDir + '/project.ts', 'ascii')
    data = data.replace(new RegExp('const csdText = `[^`]*`', 'g'), output)
    fs.writeFileSync(babylonJsDir + '/project.ts', data, 'ascii')
    console.log('-- Updating BabylonJs/project.ts `csdText` done')

    if (process.argv.indexOf('--with-json') != -1) {
        // Wipe the json folder.
        if (fs.existsSync(jsonDir)) {
            fs.rmSync(jsonDir, { recursive: true });
        }
        fs.mkdirSync(jsonDir);

        // Generate DawPlayback.json
        spawnSync('bash', [ '-c', 'cd ' + bounceDir + ' && csound DawPlayback.csd --control-rate=30 --omacro:IS_GENERATING_JSON=1 --smacro:IS_GENERATING_JSON=1' ], {
            stdio: 'inherit'
        });

        const jsonData = fs.readFileSync(bounceDir + '/DawPlayback.json', 'ascii')

        // Wrap JSON data with Javascript multiline string variable named `csdJson`.
        output = 'const csdJson = `\n\t' + jsonData + '\n\t`'

            // Update BabylonJs/project.ts csdJson variable.
        data = fs.readFileSync(babylonJsDir + '/project.ts', 'ascii')

        data = data.replace(new RegExp('const csdJson = `[^`]*`', 'g'), output)
        fs.writeFileSync(babylonJsDir + '/project.ts', data, 'ascii')
        console.log('-- Updating BabylonJs/project.ts `csdJson` done')
    }

    if (process.argv.indexOf('--mixdown') != -1) {
        spawnSync('bash', [ '-c', 'cmake -B ' + mixdownDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON -D BUILD_MIXDOWN_CSD=ON' ], {
            stdio: 'inherit'
        });
        spawnSync('bash', [ '-c', 'cd ' + mixdownDir + ' && make 2>&1' ], {
            stdio: 'inherit'
        });

        // Wipe the mixdown folder.
        if (fs.existsSync(bounceMixdownDir)) {
            fs.rmSync(bounceMixdownDir, { recursive: true })
        }
        fs.mkdirSync(bounceMixdownDir);

        // Generate stereo mixdown bounce .wav file.
        spawnSync('bash', [ '-c', 'cd ' + bounceMixdownDir + ' && csound ' + bounceDir + '/DawPlayback.csd --smacro:IS_MIXDOWN=1 --output=mixdown.aif' ], {
            stdio: 'inherit'
        });
    }
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
