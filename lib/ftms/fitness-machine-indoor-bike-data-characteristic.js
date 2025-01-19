// Main Code is from FortiusANT project and modified to suit Zwack
// https://github.com/WouterJD/FortiusANT/tree/master/node
// https://github.com/oesmith/gatt-xml/blob/master/org.bluetooth.characteristic.indoor_bike_data.xml
const Bleno = require("@abandonware/bleno");
const debugFTMS = require("debug")("ftms");
const util = require("util");
var Flags = require("../flags");

const CharacteristicUserDescription = "2901";
const IndoorBikeData = "2AD2";

class IndoorBikeDataCharacteristic extends Bleno.Characteristic {
  constructor() {
    debugFTMS("[IndoorBikeDataCharacteristic] constructor");

    super({
      uuid: IndoorBikeData,
      properties: ["notify"],
      descriptors: [
        new Bleno.Descriptor({
          uuid: CharacteristicUserDescription,
          value: "Indoor Bike Data",
        }),
        //2902 is defined by bleno
        new Bleno.Descriptor({
          // Server Characteristic Configuration
          uuid: "2903",
          value: Buffer.alloc(2),
        }),
      ],
    });

    this.indoorBikeDataFlags = new Flags([
      "more_data",
      "instantaneous_cadence",
      "average_speed",
      "average_cadence",
      "total_distance",
      "resistance_level",
      "instantaneous_power",
      "average_power",
      "expended_energy",
      "heart_rate",
      "metabolic_equivalent",
      "elapsed_time",
      "remaining_time"
    ]);

    this.updateValueCallback = null;
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    debugFTMS("[IndoorBikeDataCharacteristic] onSubscribe");
    this.updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  }

  onUnsubscribe() {
    debugFTMS("[IndoorBikeDataCharacteristic] onUnsubscribe");
    this.updateValueCallback = null;
    return this.RESULT_UNLIKELY_ERROR;
  }

  notify(event) {
    debugFTMS("[" + IndoorBikeData + "][IndoorBikeDataCharacteristic] notify");

    let offset = 0;
    let buffer = new Buffer.alloc(30);

    if (!("watts" in event)) {
      // ignore events with no watts
      return this.RESULT_SUCCESS;
    }

    //allow flags.from to work
    event.instantaneous_power = event.watts;
    event.instantaneous_cadence = event.cadence;

    let flags = this.indoorBikeDataFlags.from(event);
    buffer.writeUInt16LE(flags, offset);
    offset += 2;

    // Instantaneous speed, always 0 ATM
    offset += 2;

    if ("cadence" in event) {
      // cadence is in 0.5rpm resolution but is supplied in 1rpm resolution, multiply by 2 for ble.
      let cadence = event.cadence * 2;
      debugFTMS(
        "[" +
          IndoorBikeData +
          "][IndoorBikeDataCharacteristic] cadence(rpm): " +
          cadence +
          " (" +
          event.cadence +
          ")"
      );
      buffer.writeUInt16LE(cadence, offset);
      offset += 2;
    }

    //total distance (3), resistance level (2) are mandatory but we'll send them as 0
    offset += 5;

    if ("watts" in event) {
      let watts = event.watts;
      debugFTMS(
        "[" +
          IndoorBikeData +
          "][IndoorBikeDataCharacteristic] power(W): " +
          watts
      );
      buffer.writeInt16LE(watts, offset);
      offset += 2;
    }

    //average_power (2), total_energy (2)
    offset += 4;

    // Zwift doesn't seem to detect the heart rate in the FTMS protocol. Instead,
    // the heart rate service is used now.
    if ("heart_rate" in event) {
      let heart_rate = event.heart_rate;
      debug("[IndoorBikeDataCharacteristic] heart rate (bpm): " + heart_rate);
      buffer.writeUInt8(heart_rate, offset);
      offset += 2;
    }

    //elapsed_time
    offset += 2;

    let finalbuffer = buffer.slice(0, offset);
    debugFTMS(
      "[" +
        IndoorBikeData +
        "][IndoorBikeDataCharacteristic] " +
        util.inspect(finalbuffer)
    );
    if (this.updateValueCallback) {
      this.updateValueCallback(finalbuffer);
    }

    return this.RESULT_SUCCESS;
  }
}

module.exports = IndoorBikeDataCharacteristic;
