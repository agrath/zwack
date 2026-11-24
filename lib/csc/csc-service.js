/* Cycling Speed and Cadence Service
 * Assigned Number: 0x1816
 *
 * Supported Characteristics:
 *  0x2A5B - CSC Measurement
 *  0x2A5C - CSC Feature
 *  0x2A5D - Sensor Location
 *
 * Not supported: 0x2A55 SC Control Point (setting the cumulative wheel revolutions), which the spec
 * makes mandatory with wheel revolution data; apps reading speed and cadence don't use it.
 *
 * A speed and cadence sensor by default. List only `speed` or only `cadence` alongside `csc` to
 * simulate a speed-only or cadence-only sensor.
 *
 * Spec: https://www.bluetooth.com/specifications/specs/cycling-speed-and-cadence-service-1-0/
 */
const Bleno = require('@abandonware/bleno');
const config = require('../config');

const CSCMeasurementCharacteristic = require('./csc-measurement-characteristic');
const StaticReadCharacteristic = require('../read-characteristic');

class CSCService extends Bleno.PrimaryService {

  constructor() {
    const wheel = CSCService.hasWheelData();
    const crank = CSCService.hasCrankData();
    let cscMeasurement = new CSCMeasurementCharacteristic();
    super({
      uuid: '1816',
      characteristics: [
        cscMeasurement,

        // 16 Bit Mandatory Field
        // 0x01 - Wheel Revolution Data Supported
        // 0x02 - Crank Revolution Data Supported
        // 0x04 - Multiple Sensor Locations Supported
        new StaticReadCharacteristic('2A5C', 'CSC Feature', [(wheel ? 0x01 : 0) | (crank ? 0x02 : 0), 0]),

        // Sensor location (see rsc-service.js for the full list)
        // 0	Other
        // 5	Left Crank
        // 12	Rear Wheel
        new StaticReadCharacteristic('2A5D', 'Sensor Location', [wheel && crank ? 0 : wheel ? 12 : 5])
      ]
    });

    this.cscMeasurement = cscMeasurement;
  }

  // Speed (wheel revolutions) unless only cadence is listed
  static hasWheelData() {
    return config.has('speed') || !config.has('cadence');
  }

  // Cadence (crank revolutions) unless only speed is listed
  static hasCrankData() {
    return config.has('cadence') || !config.has('speed');
  }

  notify(event) {
    this.cscMeasurement.notify(event);
    return this.RESULT_SUCCESS;
  };
}

module.exports = CSCService;
