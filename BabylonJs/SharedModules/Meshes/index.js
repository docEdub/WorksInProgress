
const files = [
    'Rim1Mesh'
]

for (let i = 0; i < files.length; i++) {
    const file = files[i]
    module.exports[file] = require(`./${file}`)
}
