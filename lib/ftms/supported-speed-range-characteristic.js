const bleno = require('@abandonware/bleno');
const debugFTMS = require('debug')('ftms');
const util = require('util');

const CharacteristicUserDescription = '2901';
const SupportedSpeedRange = '2AD4';

class SupportedSpeedRangeCharacteristic extends bleno.Characteristic {
  constructor() {
    debugFTMS('[SupportedSpeedRangeCharacteristic] constructor');
    super({
      uuid: SupportedSpeedRange,
      properties: ['read'],
      descriptors: [
        new bleno.Descriptor({
          uuid: CharacteristicUserDescription,
          value: 'Supported Speed Range'
        })
      ],
    });
  }

  onReadRequest(offset, callback) {
    let buffer = new Buffer.alloc(6);
    let at = 0;

    // FTMS Supported Speed Range fields are in units of 0.01 km/h (NOT km/h and
    // NOT m/s). e.g. 20 km/h must be written as 2000.
    const RES = 100; // raw units per km/h

    let minimumSpeed = Math.round(0 * RES); // 0.00 km/h
    buffer.writeInt16LE(minimumSpeed, at);
    at += 2;

    let maximumSpeed = Math.round(20 * RES); // 20.00 km/h
    buffer.writeInt16LE(maximumSpeed, at);
    at += 2;

    let minimumIncrement = Math.round(0.5 * RES); // 0.50 km/h
    buffer.writeUInt16LE(minimumIncrement, at);
    at += 2;

    // For Ease Of Debugging
    let finalbuffer = buffer.slice(0, at);
    let minSpeedHex = buffer.slice(0, 2);
    let maxSpeedHex = buffer.slice(2, 4);
    let incSpeedHex = buffer.slice(4, 6);

    let minSpeedDec = finalbuffer.readInt16LE(0);
    let maxSpeedDec = finalbuffer.readInt16LE(2);
    let incSpeedDec = finalbuffer.readInt16LE(4);

    debugFTMS('[' + SupportedSpeedRange + '][SupportedSpeedRangeCharacteristic] onReadRequest - ' + util.inspect(finalbuffer));
    debugFTMS('[' + SupportedSpeedRange + '][SupportedSpeedRangeCharacteristic] onReadRequest - Min [HEX]' + util.inspect(minSpeedHex) + ' [Decimal:' + minSpeedDec + ']');
    debugFTMS('[' + SupportedSpeedRange + '][SupportedSpeedRangeCharacteristic] onReadRequest - Max [HEX]' + util.inspect(maxSpeedHex) + ' [Decimal:' + maxSpeedDec + ']');
    debugFTMS('[' + SupportedSpeedRange + '][SupportedSpeedRangeCharacteristic] onReadRequest - Inc [HEX]' + util.inspect(incSpeedHex) + ' [Decimal:' + incSpeedDec + ']');
    callback(this.RESULT_SUCCESS, buffer);
  }
}

module.exports = SupportedSpeedRangeCharacteristic;
