var os = require('os')
var watch = require('node-watch')
var spawnSync = require('child_process').spawnSync

if (os.type() === 'Darwin') {
    const pathsToWatch = [
        './Csound',
        './CsoundCMake'
    ]

    let debounce = false
    
    const make = (event, fileName) => {
        if (fileName) {
            console.log(fileName, 'changed')
            if (debounce) {
                return
            }
            debounce = setTimeout(() => {
                debounce = false
                console.log('-----------------------------------------------------------------------------------------')
                spawnSync('bash', [ '-c', 'node make' ], { stdio: 'inherit' })
                
                console.log('')
                console.log('Reloading .orc files ...')
                spawnSync('bash', [ '-c', 'cd ./Csound/build/included-output && csound ReloadOrcFiles.csd' ])
                console.log('Reloading .orc files - done')

                console.log('')
                console.log('')
            }, 100)
        }
    }

    console.log('\nWatching folders ...')
    pathsToWatch.forEach(path => {
        console.log('  ', path)
        watch(path, {
            recursive: true,
            filter(path, skip) {
                if (/\/build\/\bCMakeCache.txt\b$/.test(path)) return true
                if (/\/build/.test(path)) return skip
                return true
            }
        }, make)
    })
    console.log('\n')
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
