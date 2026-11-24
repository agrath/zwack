var Bleno = require('@abandonware/bleno');
var debugCSC = require('debug')('csc');

// Spec
// https://www.bluetooth.com/specifications/specs/cycling-speed-and-cadence-service-1-0/
// Flags (uint8), then if present:
//   Cumulative Wheel Revolutions (uint32), Last Wheel Event Time (uint16, 1/1024 s)
//   Cumulative Crank Revolutions (uint16), Last Crank Event Time (uint16, 1/1024 s)

const WheelRevolutionDataPresent = 0x01;
const CrankRevolutionDataPresent = 0x02;

class CSCMeasurementCharacteristic extends Bleno.Characteristic {

  constructor() {
    super({
      uuid: '2A5B',
      value: null,
      properties: ['notify'],
      descriptors: [
        new Bleno.Descriptor({
          uuid: '2901',
          value: 'CSC Measurement'
        }),
        //2902 is defined by bleno
        new Bleno.Descriptor({
          // Server Characteristic Configuration
          uuid: '2903',
          value: Buffer.alloc(2)
        })
      ]
    });

    this._updateValueCallback = null;
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    debugCSC('[CSCMeasurementCharacteristic] client subscribed');
    this._updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  };

  onUnsubscribe() {
    debugCSC('[CSCMeasurementCharacteristic] client unsubscribed');
    this._updateValueCallback = null;
  };

  // event: { wheel_revs, wheel_event_time } and/or { crank_revs, crank_event_time }, the event times in
  // seconds (the time of the last whole revolution, on any running clock)
  notify(event) {
    const wheel = ('wheel_revs' in event);
    const crank = ('crank_revs' in event);
    if (!wheel && !crank) {
      return this.RESULT_SUCCESS;
    }

    let buffer = Buffer.alloc(11);
    let offset = 0;

    buffer.writeUInt8((wheel ? WheelRevolutionDataPresent : 0) | (crank ? CrankRevolutionDataPresent : 0), offset);
    offset += 1;

    if (wheel) {
      buffer.writeUInt32LE(event.wheel_revs % 4294967296, offset);
      offset += 4;
      buffer.writeUInt16LE(Math.round(event.wheel_event_time * 1024) % 65536, offset);
      offset += 2;
    }

    if (crank) {
      buffer.writeUInt16LE(event.crank_revs % 65536, offset);
      offset += 2;
      buffer.writeUInt16LE(Math.round(event.crank_event_time * 1024) % 65536, offset);
      offset += 2;
    }

    debugCSC('CSC wheel_revs:' + event.wheel_revs + ' crank_revs:' + event.crank_revs + ' Msg:' + buffer.slice(0, offset).toString('hex'));

    if (this._updateValueCallback) {
      this._updateValueCallback(buffer.slice(0, offset));
    }

    return this.RESULT_SUCCESS;
  }
};

module.exports = CSCMeasurementCharacteristic;
