
const RimMesh = require('./Common/RimMesh')

class Rim1HiArpMesh extends RimMesh {
    scaling = 1
    y = 1565
    rows = 3
    rowAngle = 1 // degrees
    segments = 240
    segmentRadius = 2000
    segmentCenterY = 500
}

module.exports = new Rim1HiArpMesh
