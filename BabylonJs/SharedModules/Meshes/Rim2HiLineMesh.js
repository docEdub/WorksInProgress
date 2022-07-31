
const RimMesh = require('./Common/RimMesh')

class Rim2HiLineMesh extends RimMesh {
    scaling = 2
    y = 500
    rows = 6
    rowAngle = 1 // degrees
    segments = 240
    segmentRadius = 500
    segmentCenterY = 250
}

module.exports = new Rim2HiLineMesh
