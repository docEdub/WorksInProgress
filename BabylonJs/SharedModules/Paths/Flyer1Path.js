
const FlyerPath = require('./Common/FlyerPath')

class Flyer1Path extends FlyerPath {
    name = "Flyer1Path"
    height = 230 // above center of main pyramid mesh's top piece
    startRotation = 0 // degrees
}

module.exports = new Flyer1Path
