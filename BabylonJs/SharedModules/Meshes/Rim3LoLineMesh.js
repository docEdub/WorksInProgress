
const RimMesh = require('./Common/RimMesh')

class Rim3LoLineMesh extends RimMesh {
    scaling = 2
    y = 284
    rows = 6
    rowAngle = 1 // degrees
    segments = 240
    segmentRadius = 400
    segmentCenterY = 250
}

module.exports = new Rim3LoLineMesh
