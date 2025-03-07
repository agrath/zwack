var debugFTMS = require("debug")("ftms");
var Bleno = require('@abandonware/bleno');
var Flags = require('../flags');

// Spec
// https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.characteristic.treadmill_data.xml
// https://github.com/oesmith/gatt-xml/blob/master/org.bluetooth.characteristic.treadmill_data.xml

class TreadmillDataCharacteristic extends Bleno.Characteristic {
  constructor() {
    super({
      uuid: "2ACD",
      properties: ["notify"],
      descriptors: [
        new Bleno.Descriptor({
          uuid: "2901",
          value: "Treadmill Data",
        }),
        //2902 is defined by bleno
        new Bleno.Descriptor({
          // Server Characteristic Configuration
          uuid: "2903",
          value: Buffer.alloc(2),
        }),
      ],
    });

    this.counter = 1;
    this.averageSpeed = null;
    this.lastTimestamp = new Date();
    this.totalDistance = 0;

    this.treadmillDataFlags = new Flags([
      "more_data",
      "average_speed",
      "total_distance",
      "inclination",
      "elevation_gain",
      "instantaneous_pace",
      "average_pace",
      "expended_energy",
      "heart_rate",
      "elapsed_time",
      "remaining_time",
      "force",
    ]);

    this._updateValueCallback = null;
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    debugFTMS("[TreadmillDataCharacteristic] client subscribed to PM");
    this._updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  }

  onUnsubscribe() {
    debugFTMS("[TreadmillDataCharacteristic] client unsubscribed from PM");
    this._updateValueCallback = null;
    return this.RESULT_UNLIKELY_ERROR;
  }
 
  calcRunningAvg(previousAverage, currentNumber, index) {
    // [ avg' * (n-1) + x ] / n
    return ( previousAverage * (index - 1) + currentNumber ) / index;
  }

 updateDistance(speed, lastTimestamp, currentTimestamp) {
    // Calculate the time difference in seconds
    const timeDifference = (currentTimestamp - lastTimestamp) / 1000;

    // Increment the total distance
    let newDistance = this.totalDistance + (speed * timeDifference);

    return newDistance; // Optionally return the updated total distance
  }

  calculateRampAngle(inclinationPercent) {
    const radians = Math.atan(inclinationPercent / 100); // Convert % to ratio and find arctangent
    const degrees = radians * (180 / Math.PI); // Convert radians to degrees
    return degrees;
  }

 convertMetersPerSecondToKilometersPerMinute(speedInMetersPerSecond) {
    const speedInKilometersPerMinute = speedInMetersPerSecond * (60 / 1000);
    return speedInKilometersPerMinute;
  }
 
  writeUInt24(buffer, offset, value) {
    if (value < 0 || value > 0xFFFFFF) {
        throw new RangeError("Value must be in the range 0 to 16777215 (24-bit unsigned integer).");
    }

    // Write 3 bytes (24 bits) to the buffer in little-endian order
    buffer.writeUInt8(value & 0xFF, offset);             // Least significant byte
    buffer.writeUInt8((value >> 8) & 0xFF, offset + 1);  // Middle byte
    buffer.writeUInt8((value >> 16) & 0xFF, offset + 2); // Most significant byte
  }

  notify(event) {
    if (!("speed" in event)) {
      // ignore events with no speed
      return this.RESULT_SUCCESS;
    }

    if (this.averageSpeed == null)
    {
      //initialise average speed
      this.averageSpeed = event.speed;
    }
    this.counter ++;
    
    const currentTimestamp = new Date();
    this.averageSpeed = this.calcRunningAvg(this.averageSpeed, event.speed, this.counter);
    event.average_speed = this.averageSpeed;
    this.totalDistance = this.updateDistance(event.speed, this.lastTimestamp, currentTimestamp)
    event.total_distance = this.totalDistance;
    this.lastTimestamp = currentTimestamp;

    event.instantaneous_pace = this.convertMetersPerSecondToKilometersPerMinute(event.speed) * 10; //m/s we want km/m *10
    event.average_pace = this.convertMetersPerSecondToKilometersPerMinute(this.averageSpeed) * 10
    event.average_speed = this.averageSpeed;
    
    if ("inclination" in event)
    {
        event.ramp_angle = this.calculateRampAngle(event.inclination);
    }

    //flags (2) + instantaneous_speed (2) + average_speed (2) + total_distance (3) + inclination (2) + ramp angle (2) + instant_pace (1) + average_pace (1) + heart_rate (1)
    var buffer = new Buffer.alloc(16);
    let offset = 0;

    // flags
    // 00000000 00000001 - 0x0001 - More Data
    // 00000000 00000010 - 0x0002 - Average Speed Present (Kilometer per hour with a resolution of 0.01)
    // 00000000 00000100 - 0x0004 - Total Distance Present
    // 00000000 00001000 - 0x0008 - Inclination and Ramp Angle Setting present
    // 00000000 00010000 - 0x0010 - Elevation Gain present
    // 00000000 00100000 - 0x0020 - Instantaneous Pace present
    // 00000000 01000000 - 0x0040 - Average Pace present
    // 00000000 10000000 - 0x0080 - Expended Energy present
    // 00000001 00000000 - 0x0100 - Heart Rate present
    // 00000010 00000000 - 0x0200 - Elapsed Time present
    // 00000100 00000000 - 0x0400 - Remaining Time present
    // 00001000 00000000 - 0x0800 - Force on Belt and Power Output present

    debugFTMS(JSON.stringify(event));
    
    // flags
    let flags = this.treadmillDataFlags.from(event);
    buffer.writeUInt16LE(flags, offset);
    offset += 2;

    if ("speed" in event) {
      //event.speed is in m/s, we want 0.01 Km/h
      var speed = Math.round(event.speed * 3.6 * 100);
      buffer.writeUInt16LE(speed, offset);
      offset += 2;
    }

    if ("average_speed" in event) {
      var average_speed = Math.round(event.average_speed * 3.6 * 100);
      buffer.writeUInt16LE(average_speed, offset);
      offset += 2;
    }
    
    if ("total_distance" in event) {
      var total_distance = event.total_distance;
      this.writeUInt24(buffer, offset, total_distance)
      offset += 3;
    }

    if ("inclination" in event) {
      var inclination = event.inclination;
      buffer.writeInt16LE(inclination, offset); 
      offset += 2;

      var ramp_angle = event.ramp_angle;
      buffer.writeInt16LE(ramp_angle, offset); 
      offset += 2;
    }

    if ("instantaneous_pace" in event) {
      var instantaneous_pace = event.instantaneous_pace;
      buffer.writeUInt8(instantaneous_pace, offset);
      offset += 1;
    }

    if ("average_pace" in event) {
      var average_pace = event.average_pace;
      buffer.writeUInt8(average_pace, offset);
      offset += 1;
    }

    if ("heart_rate" in event && this.treadmillDataFlags.isSet("heart_rate")) {
      //bpm with resolution of 1
      buffer.writeUInt8(event.heart_rate, offset);
      offset += 1;
    }

    if (this._updateValueCallback) {
      this._updateValueCallback(buffer.slice(0, offset));
    }
    return this.RESULT_SUCCESS;
  }
}

module.exports = TreadmillDataCharacteristic;
