const bleno = require('@abandonware/bleno');
const debugFTMS = require('debug')('ftms');
const util = require('util');

const CharacteristicUserDescription = '2901';
const SupportedResistanceLevelRange = '2AD6';

class SupportedResistanceLevelRangeCharacteristic extends bleno.Characteristic {
  constructor() {
    debugFTMS('[SupportedResistanceLevelRangeCharacteristic] constructor');
    super({
      uuid: SupportedResistanceLevelRange,
      properties: ['read'],
      descriptors: [
        new bleno.Descriptor({
          uuid: CharacteristicUserDescription,
          value: 'Supported Resistance Level Range'
        })
      ],
    });
  }

  onReadRequest(offset, callback) {
    // Values are in 0.1 resolution (e.g., 0 = 0.0, 200 = 20.0)
    let buffer = new Buffer.alloc(6);
    let at = 0;

    let minimumResistance = 0;
    buffer.writeInt16LE(minimumResistance, at);
    at += 2;

    let maximumResistance = 200; // 20.0 in 0.1 resolution
    buffer.writeInt16LE(maximumResistance, at);
    at += 2;

    let minimumIncrement = 1; // 0.1 in 0.1 resolution
    buffer.writeUInt16LE(minimumIncrement, at);
    at += 2;

    debugFTMS('[' + SupportedResistanceLevelRange + '][SupportedResistanceLevelRangeCharacteristic] onReadRequest - ' + util.inspect(buffer));
    debugFTMS('[' + SupportedResistanceLevelRange + '] Min: ' + minimumResistance * 0.1 + ', Max: ' + maximumResistance * 0.1 + ', Inc: ' + minimumIncrement * 0.1);
    callback(this.RESULT_SUCCESS, buffer);
  }
}

module.exports = SupportedResistanceLevelRangeCharacteristic;
