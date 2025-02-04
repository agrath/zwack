var Bleno = require('@abandonware/bleno');
var debugHR = require('debug')('hr');
var Flags = require('../flags');

class HeartRateMeasurementCharacteristic extends Bleno.Characteristic {

  constructor() {
    super({
      uuid: '2A37',
      value: null,
      properties: ['notify'],
      descriptors: [
        new Bleno.Descriptor({
					uuid: '2901',
					value: 'Heartrate'
				}),
        //2902 is defined by bleno
        new Bleno.Descriptor({
					// Server Characteristic Configuration
					uuid: '2903',
					value: Buffer.alloc(2)
				})
      ]
    });

    this.hrFlags = new Flags([
      'value_format',
      'sensor_contact_status',
      'energy_expended',
      'rr_interval'
    ]);

    this._updateValueCallback = null;
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    debugHR('[HeartRateMeasurementCharacteristic] client subscribed to PM');
    this._updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  };

  onUnsubscribe() {
    debugHR('[HeartRateMeasurementCharacteristic] client unsubscribed from PM');
    this._updateValueCallback = null;
    return this.RESULT_UNLIKELY_ERROR;
  };

  notify(event) {
    if (!('heart_rate' in event)) {
      // Heart rate is mandatory so ignore events without
      return this.RESULT_SUCCESS;;
    }

    let buffer = new Buffer.alloc(4);
    let offset = 0;

    // flags
    buffer.writeUInt8(this.hrFlags.from(event), offset);
    offset += 1;

    // Unit is in bpm with a resolution of 1
    debugHR("HR: " + event.heart_rate);
    buffer.writeUInt8(Math.floor(heart_rate), offset);

    if (this._updateValueCallback) {
      this._updateValueCallback(buffer.slice(0, offset));
    }

    return this.RESULT_SUCCESS;
  }


};

module.exports = HeartRateMeasurementCharacteristic;
