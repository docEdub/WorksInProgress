
const files = [
    'Meshes/Rim1Mesh'
]

for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const object = file.split('/').pop()
    module.exports[object] = require(`./${file}`)
}
