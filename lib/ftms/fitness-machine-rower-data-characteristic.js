var debugFTMS = require("debug")("ftms");
var Bleno = require("@abandonware/bleno");
var Flags = require("../flags");

//https://www.reddit.com/r/Rowing/comments/er2zsx/how_to_calculate_an_estimate_distance_per_stroke/
const DISTANCE_PER_STROKE = 8.8; //meters
//
const POWER_CONSTANT_WATTS = 250;
const POWER_CONSTANT_STROKE_RATE = 28;

// Spec
// https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.characteristic.rower_data.xml
// https://github.com/oesmith/gatt-xml/blob/master/org.bluetooth.characteristic.rower_data.xml

class RowerDataCharacteristic extends Bleno.Characteristic {
  constructor() {
    super({
      uuid: "2AD1",
      properties: ["notify"],
      descriptors: [
        new Bleno.Descriptor({
          uuid: "2901",
          value: "Rower Data",
        }),
        //2902 is defined by bleno
        new Bleno.Descriptor({
          // Server Characteristic Configuration
          uuid: "2903",
          value: Buffer.alloc(2),
        }),
      ],
    });

    this.rowerDataFlags = new Flags([
      "more_data",
      "average_stroke",
      "total_distance",
      "instantaneous_pace",
      "average_pace",
      "instantaneous_power",
      "average_power",
      "resistance_level",
      "expended_energy",
      "heart_rate",
      "metabolic_equivalent",
      "elapsed_time",
      "remaining_time",
    ]);

    this.lastTimestamp = new Date();
    this.totalDistance = 0;
    this.strokeCount = 0;
    this.strokeAccumulator = 0; // Store fractional strokes

    this._updateValueCallback = null;
  }

  updateStrokeCount(stroke_rate, lastTimestamp, currentTimestamp) {
    // Calculate the time difference in seconds
    const timeDifference = (currentTimestamp - lastTimestamp) / 1000;

    // Convert stroke rate from strokes per minute to strokes per second
    const strokesPerSecond = stroke_rate / 60;

    // Calculate strokes since last update (may be fractional)
    const strokesSinceLastUpdate = strokesPerSecond * timeDifference;

    // Accumulate fractional strokes
    this.strokeAccumulator += strokesSinceLastUpdate;

    // Extract whole strokes from the accumulator
    const wholeStrokes = Math.floor(this.strokeAccumulator);

    // Reduce the accumulator by the whole strokes counted
    this.strokeAccumulator -= wholeStrokes;

    // Update stroke count
    this.strokeCount += wholeStrokes;

    return this.strokeCount;
  }

  updateDistance() {
    this.totalDistance = this.strokeCount * DISTANCE_PER_STROKE;
    return this.totalDistance;
  }

  updatePower(stroke_rate) {
    //we approximate power for the purposes of the simulator, so we say you are generating 250w at stroke rate 28
    //therefore the current power can be current stroke_rate/constant stroke rate * constant_watts
    // const POWER_CONSTANT_WATTS = 250;
    // const POWER_CONSTANT_STROKE_RATE = 28;
    this.power =
      (stroke_rate / POWER_CONSTANT_STROKE_RATE) * POWER_CONSTANT_WATTS;
    return this.power;
  }

  onSubscribe(maxValueSize, updateValueCallback) {
    debugFTMS("[RowerDataCharacteristic] client subscribed to PM");
    this._updateValueCallback = updateValueCallback;
    return this.RESULT_SUCCESS;
  }

  onUnsubscribe() {
    debugFTMS("[RowerDataCharacteristic] client unsubscribed from PM");
    this._updateValueCallback = null;
    return this.RESULT_UNLIKELY_ERROR;
  }

  writeUInt24(buffer, offset, value) {
    if (value < 0 || value > 0xffffff) {
      throw new RangeError(
        "Value must be in the range 0 to 16777215 (24-bit unsigned integer)."
      );
    }

    // Write 3 bytes (24 bits) to the buffer in little-endian order
    buffer.writeUInt8(value & 0xff, offset); // Least significant byte
    buffer.writeUInt8((value >> 8) & 0xff, offset + 1); // Middle byte
    buffer.writeUInt8((value >> 16) & 0xff, offset + 2); // Most significant byte
  }

  notify(event) {
    //when more_data is false,
    //stroke_rate, stroke_count are required

    if (!("stroke_rate" in event)) {
      // ignore events with no stroke_rate
      return this.RESULT_SUCCESS;
    }

    const currentTimestamp = new Date();

    //the simulator will emit stroke_rate at spm (strokes per minute)
    //therefore, the stroke_count can be updated by taking the time since the last emit
    this.strokeCount = this.updateStrokeCount(
      event.stroke_rate,
      this.lastTimestamp,
      currentTimestamp
    );
    event.stroke_count = this.strokeCount;

    //distance approximated as strokeCount * distance per stroke
    this.totalDistance = this.updateDistance();
    event.total_distance = this.totalDistance;

    this.power = this.updatePower();
    event.instantaneous_power = this.power;

    this.lastTimestamp = currentTimestamp;

    //flags (2) + stroke_rate (1) + stroke_count (2) + total_distance (3) + instantaneous_power (2) + heart_rate (1)
    var buffer = new Buffer.alloc(11);
    let offset = 0;

    debugFTMS(JSON.stringify(event));

    // flags
    let flags = this.rowerDataFlags.from(event);
    buffer.writeUInt16LE(flags, offset);
    offset += 2;

    if ("stroke_rate" in event) {
      //stroke rate is supplied in spm, output 0.5 stroke/m
      var strokeRate = Math.round(event.stroke_rate / 2);
      buffer.writeUInt8(strokeRate, offset);
      offset += 1;
    }

    if ("stroke_count" in event) {
      buffer.writeUInt16LE(this.strokeCount, offset);
      offset += 2;
    }

    if ("total_distance" in event) {
      var total_distance = event.total_distance;
      this.writeUInt24(buffer, offset, total_distance);
      offset += 3;
    }

    if ("instantaneous_power" in event) {
      var instantaneous_power = event.instantaneous_power;
      buffer.writeInt16LE(instantaneous_power, offset);
      offset += 2;
    }

    if ("heart_rate" in event && this.rowerDataFlags.isSet("heart_rate")) {
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

module.exports = RowerDataCharacteristic;
