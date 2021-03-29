var os = require('os');
var watch = require('node-watch');
var spawn = require('child_process').spawn;

if (os.type() === 'Darwin') {
    const foldersToWatch = [
        './Csound',
        '../../Libraries/CsoundCMake'
    ]

    let debounce = false
    
    const make = (event, fileName) => {
        if (fileName) {
            console.log('\n', fileName, 'changed ...')
            if (debounce) {
                return
            }
            debounce = setTimeout(() => {
                debounce = false
            }, 100) 
            spawn('bash', [ '-c', 'node make'], { stdio: 'inherit' })
        }
    }

    console.log('\nWatching folders ...')
    foldersToWatch.forEach(folder => {
        console.log('  ', folder)
        watch(folder, {
            recursive: true,
            filter(path, skip) {
                if (/\/build/.test(path)) {
                    return skip
                }
                return true
            }
        }, make)
    })
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
