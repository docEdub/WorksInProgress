
const modulePaths = [
    'Meshes/Rim1Mesh'
]

for (let i = 0; i < modulePaths.length; i++) {
    const modulePath = modulePaths[i]
    const object = modulePath.split('/').pop()
    module.exports[object] = require(`./${modulePath}`)
}
