var debugFTMS = require("debug")("ftms");
var Bleno = require("bleno");

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

  notify(event) {
    if (!("speed" in event)) {
      // ignore events with no speed
      return this.RESULT_SUCCESS;
    }
    var buffer = new Buffer.alloc(8);
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

    // flags
    let flags = this.treadmillDataFlags.from(event);
    buffer.writeUInt16LE(flags, offset);
    offset += 2;

    if ("speed" in event) {
      var speed = event.speed;
      debugFTMS("speed: " + speed);
      buffer.writeInt16LE(speed, offset);
      offset += 2;
    }

    if (this.treadmillDataFlags.isSet("heart_rate")) {
      //bpm with resolution of 1
      buffer.writeUInt8(event.heart_rate, offset);
      offset += 1;
    }

    if (this._updateValueCallback) {
      this._updateValueCallback(buffer);
    }
    return this.RESULT_SUCCESS;
  }
}

module.exports = TreadmillDataCharacteristic;
