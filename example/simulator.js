var ZwackBLE = require("../lib/zwack-ble-sensor");
const blessed = require("blessed");
const parseArgs = require("minimist");
const args = parseArgs(process.argv.slice(2));

let containsFTMSBike = false;
let containsFTMSTreadmill = false;
let containsFTMSRow = false;
let containsFTMSControl = false;
let containsRSC = false;
let containsCSP = false;
let containsSPD = false;
let containsPWR = false;
let containsCAD = false;
let containsHR = false;
let metric = false;

if (args.variable === undefined) {
  console.error(
    "Error: variable parameter is required eg: npm run simulator -- --variable=ftms-bike"
  );
  process.exit(1);
} else {
  containsFTMSBike = args.variable.includes("ftms-bike");
  containsFTMSTreadmill = args.variable.includes("ftms-treadmill");
  containsFTMSRow = args.variable.includes("ftms-row");
  containsFTMSControl = args.variable.includes("ftms-control");
  containsRSC = args.variable.includes("rsc");
  containsCSP = args.variable.includes("csp");
  containsSPD = args.variable.includes("speed");
  containsPWR = args.variable.includes("power");
  containsCAD = args.variable.includes("cadence");
  containsHR = args.variable.includes("heartrate");
  metric = args.variable.includes("metric");
}

// default parameters
let hr = 130;
let cadence = 90;
let power = 130;
let powerMeterSpeed = 18; // kmh
let powerMeterSpeedUnit = 2048; // Last Event time expressed in Unit of 1/2048 second
let runningCadence = 180;
let runningSpeed = 0;
//According to Strava, the average running pace for a logged run is 9:53 per mile. This works out to an average running speed of just over 6 miles per hour.
if (!metric) {
  runningSpeed = 6; // 6 miles/hour or 9:53/mile
} else {
  runningSpeed = 10; // 10 km/hour or 6:00/km
}
let rowStrokeRate = 24; //average is 24-30
let randomness = 5;
let cadRandomness = 5;
let hrRandomness = 5;
let sensorName = "Zwack";

let incr = 5;
let runningIncr = 0.5;
let runningInclineIncr = 0.5;
let runningIncline = 0;
let stroke_count = 0;
let wheel_count = 0;
let wheel_circumference = 2096; // millimeter
let notificationInterval = 1000;
let hrUpdateInterval = 5000;
let watts = power;
let hrNoise = 0;

let prevCadTime = 0;
let prevCadInt = 0;

let paused = false;
let pausedCadence = 0;
let pausedPower = 0;
let pausedHr = 0;
let pausedRunningSpeed = 0;
let pausedPowerMeterSpeed = 0;
let pausedRunningCadence = 0;
let pausedRowStrokeRate = 0;

// ─── Blessed TUI ───────────────────────────────────────────────────────────

const screen = blessed.screen({
  smartCSR: true,
  title: "Zwack BLE Simulator",
});

// Services panel - top left
const servicesBox = blessed.box({
  top: 0,
  left: 0,
  width: "35%",
  height: 12,
  label: " Services ",
  border: { type: "line" },
  style: {
    border: { fg: "cyan" },
    label: { fg: "cyan", bold: true },
  },
  tags: true,
});

// Shortcuts panel - top right
const shortcutsBox = blessed.box({
  top: 0,
  left: "35%",
  width: "65%",
  height: 12,
  label: " Keyboard Shortcuts ",
  border: { type: "line" },
  style: {
    border: { fg: "yellow" },
    label: { fg: "yellow", bold: true },
  },
  tags: true,
});

// Values panel - middle
const valuesBox = blessed.box({
  top: 12,
  left: 0,
  width: "100%",
  height: 7,
  label: " Current Values ",
  border: { type: "line" },
  style: {
    border: { fg: "green" },
    label: { fg: "green", bold: true },
  },
  tags: true,
});

// Log panel - bottom, fills remaining space
const logBox = blessed.log({
  top: 19,
  left: 0,
  width: "100%",
  height: "100%-19",
  label: " Log ",
  border: { type: "line" },
  style: {
    border: { fg: "white" },
    label: { fg: "white", bold: true },
  },
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    style: { bg: "blue" },
  },
  mouse: true,
});

screen.append(servicesBox);
screen.append(shortcutsBox);
screen.append(valuesBox);
screen.append(logBox);

// Exit keys
screen.key(["x", "q", "C-c"], () => process.exit(0));

// ─── Rendering functions ───────────────────────────────────────────────────

function renderServices() {
  const svc = (name, enabled) =>
    enabled
      ? `  {green-fg}●{/green-fg} {bold}${name}{/bold}`
      : `  {red-fg}○{/red-fg} ${name}`;

  servicesBox.setContent(
    [
      svc("FTMS Bike", containsFTMSBike),
      svc("FTMS Treadmill", containsFTMSTreadmill),
      svc("FTMS Rower", containsFTMSRow),
      svc("FTMS Control", containsFTMSControl),
      svc("CSP (Cycling Power)", containsCSP),
      svc("RSC (Run Speed/Cadence)", containsRSC),
      svc("Heart Rate", containsHR),
      "",
      `  Sensor: {bold}${sensorName}{/bold}`,
    ].join("\n")
  );
}

function renderShortcuts() {
  shortcutsBox.setContent(
    [
      "  {bold}c/C{/bold}  Cadence ±" + incr +
        "      {bold}p/P{/bold}  Power ±" + incr +
        "       {bold}h/H{/bold}  Heart rate ±" + incr,
      "  {bold}s/S{/bold}  Speed ±" + runningIncr +
        "       {bold}d/D{/bold}  Run cadence ±" + runningIncr +
        "  {bold}e/E{/bold}  Incline ±" + runningInclineIncr,
      "  {bold}w/W{/bold}  Stroke rate ±" + incr +
        "  {bold}i/I{/bold}  Increment ±1",
      "",
      "  {bold}r/R{/bold}  Power randomness   {bold}t/T{/bold}  Cadence randomness  {bold}n/N{/bold}  HR randomness",
      "",
      "  {bold}0{/bold}  Stop   {bold}1{/bold}  Easy   {bold}2{/bold}  Tempo   {bold}3{/bold}  Threshold   {bold}a{/bold}  Pause/Resume",
      "",
      "  {bold}x/q{/bold}  Exit",
    ].join("\n")
  );
}

function renderValues() {
  const lines = [];

  if (containsFTMSBike || containsCSP) {
    lines.push(
      `  {bold}Cycling:{/bold}   Power: {yellow-fg}${power}{/yellow-fg} W` +
        `   Cadence: {yellow-fg}${cadence}{/yellow-fg} rpm` +
        `   Speed: {yellow-fg}${powerMeterSpeed}{/yellow-fg} km/h` +
        (paused ? "  {red-fg}[PAUSED]{/red-fg}" : "")
    );
  }

  if (containsFTMSTreadmill || containsRSC) {
    const paceStr = speedToPace(runningSpeed);
    const unit = metric ? "km/h" : "m/h";
    const paceUnit = metric ? "min/km" : "min/mi";
    lines.push(
      `  {bold}Running:{/bold}  Speed: {yellow-fg}${runningSpeed}{/yellow-fg} ${unit} (${paceStr} ${paceUnit})` +
        `   Cadence: {yellow-fg}${Math.floor(runningCadence)}{/yellow-fg} spm` +
        `   Incline: {yellow-fg}${runningIncline}{/yellow-fg}%`
    );
  }

  if (containsFTMSRow) {
    lines.push(
      `  {bold}Rowing:{/bold}   Stroke rate: {yellow-fg}${rowStrokeRate}{/yellow-fg} spm`
    );
  }

  if (containsHR) {
    lines.push(
      `  {bold}HR:{/bold}       {yellow-fg}${hr}{/yellow-fg} bpm` +
        `   (randomness: ${hrRandomness})`
    );
  }

  lines.push(
    `  {bold}Settings:{/bold} Randomness: ${randomness}  Cad randomness: ${cadRandomness}  Increment: ${incr}`
  );

  valuesBox.setContent(lines.join("\n"));
}

function log(msg) {
  const now = new Date();
  const ts = now.toTimeString().slice(0, 8);
  logBox.log(`{gray-fg}${ts}{/gray-fg} ${msg}`);
}

function refreshScreen() {
  renderValues();
  screen.render();
}

// ─── Keyboard handling ─────────────────────────────────────────────────────

screen.on("keypress", (ch, key) => {
  if (key.name === "x" || key.name === "q" || (key.ctrl && key.name === "c")) {
    return; // handled by screen.key above
  }

  let factor, runFactor, runInclineFactor, rowFactor;

  if (key.shift) {
    factor = incr;
    runFactor = runningIncr;
    runInclineFactor = runningInclineIncr;
    rowFactor = incr;
  } else {
    factor = -incr;
    runFactor = -runningIncr;
    runInclineFactor = -runningInclineIncr;
    rowFactor = -incr;
  }

  switch (key.name) {
    case "c":
      cadence = Math.max(0, Math.min(200, cadence + factor));
      break;
    case "p":
      power = Math.max(0, Math.min(2500, power + factor));
      break;
    case "h":
      hr = Math.max(80, Math.min(190, hr + factor));
      break;
    case "r":
      randomness = Math.max(0, randomness + factor);
      break;
    case "t":
      cadRandomness = Math.max(0, cadRandomness + factor);
      break;
    case "n":
      hrRandomness = Math.max(0, hrRandomness + factor);
      break;
    case "e":
      runningIncline = Math.max(0, Math.min(12, runningIncline + runInclineFactor));
      break;
    case "s":
      runningSpeed = Math.max(0, runningSpeed + runFactor);
      powerMeterSpeed = Math.max(0, powerMeterSpeed + factor);
      break;
    case "w":
      rowStrokeRate = Math.max(0, rowStrokeRate + rowFactor);
      break;
    case "d":
      runningCadence = Math.max(0, runningCadence + runFactor);
      break;
    case "i":
      incr = Math.max(1, incr + Math.abs(factor) / factor);
      renderShortcuts();
      break;
    case "a":
      if (!paused) {
        paused = true;
        pausedCadence = cadence;
        pausedPower = power;
        pausedHr = hr;
        pausedRunningSpeed = runningSpeed;
        pausedPowerMeterSpeed = powerMeterSpeed;
        pausedRunningCadence = runningCadence;
        pausedRowStrokeRate = rowStrokeRate;
        cadence = 0;
        power = 0;
        hr = 75;
        runningSpeed = 0;
        powerMeterSpeed = 0;
        runningCadence = 0;
        rowStrokeRate = 0;
        log("{yellow-fg}Paused{/yellow-fg} — all values zeroed");
      } else {
        paused = false;
        cadence = pausedCadence;
        power = pausedPower;
        hr = pausedHr;
        runningSpeed = pausedRunningSpeed;
        powerMeterSpeed = pausedPowerMeterSpeed;
        runningCadence = pausedRunningCadence;
        rowStrokeRate = pausedRowStrokeRate;
        log("{green-fg}Resumed{/green-fg} — values restored");
      }
      break;
    case "0":
      power = 0; cadence = 0; runningCadence = 0; runningSpeed = 0; hr = 55; rowStrokeRate = 0;
      log("Quick stop — all values zeroed");
      break;
    case "1":
      power = 130; cadence = 80; runningCadence = 170; runningSpeed = 10; hr = 130; rowStrokeRate = 18;
      log("Preset: Easy");
      break;
    case "2":
      power = 190; cadence = 90; hr = 130; runningCadence = 170; runningSpeed = 11; rowStrokeRate = 22;
      log("Preset: Tempo");
      break;
    case "3":
      power = 250; cadence = 98; runningCadence = 180; runningSpeed = 12; hr = 160; rowStrokeRate = 28;
      log("Preset: Threshold");
      break;
  }
  refreshScreen();
});

// ─── BLE Sensor ────────────────────────────────────────────────────────────

const zwackBLE = new ZwackBLE({
  name: sensorName,
  modelNumber: "ZW-38BC",
  serialNumber: "06-C8673287492DE",
});

// ─── Notification functions ────────────────────────────────────────────────

let notifyPowerCSP = function () {
  watts = power > 0 ? Math.floor(Math.random() * randomness + power) : 0;
  try {
    zwackBLE.notifyCSP({ watts: watts });
  } catch (e) {
    log(`{red-fg}CSP error: ${e}{/red-fg}`);
  }
  setTimeout(notifyPowerCSP, notificationInterval);
};

let notifyBikeFTMS = function () {
  watts = power > 0 ? Math.floor(Math.random() * randomness + power) : 0;
  rpm = cadence > 0 && power > 0 ? Math.floor(Math.random() * cadRandomness + cadence) : 0;
  const heartRate = containsHR && hr > 89 ? hr + hrNoise : undefined;
  try {
    zwackBLE.notifyFTMS({ watts: watts, cadence: cadence, heart_rate: heartRate });
  } catch (e) {
    log(`{red-fg}FTMS Bike error: ${e}{/red-fg}`);
  }
  setTimeout(notifyBikeFTMS, notificationInterval);
};

let notifyTreadmillFTMS = function () {
  prepareRunningData();
  const heartRate = containsHR && hr > 89 ? hr + hrNoise : undefined;
  try {
    zwackBLE.notifyFTMS({ speed: notifyRunningSpeed, inclination: notifyRunningIncline, heart_rate: heartRate });
  } catch (e) {
    log(`{red-fg}FTMS Treadmill error: ${e}{/red-fg}`);
  }
  setTimeout(notifyTreadmillFTMS, notificationInterval);
};

let notifyRowFTMS = function () {
  const heartRate = containsHR && hr > 89 ? hr + hrNoise : undefined;
  try {
    zwackBLE.notifyFTMS({ stroke_rate: rowStrokeRate, heart_rate: heartRate });
  } catch (e) {
    log(`{red-fg}FTMS Row error: ${e}{/red-fg}`);
  }
  setTimeout(notifyRowFTMS, notificationInterval);
};

let updateHeartRate = function () {
  hrNoise = Math.floor(Math.random() * hrRandomness) - hrRandomness / 2;
  setTimeout(updateHeartRate, hrUpdateInterval);
};

let notifyCadenceCSP = function () {
  stroke_count += 1;
  if (cadence <= 0) {
    cadence = 0;
    setTimeout(notifyCadenceCSP, notificationInterval);
    return;
  }
  try {
    zwackBLE.notifyCSP({ watts: watts, rev_count: stroke_count });
  } catch (e) {
    log(`{red-fg}CSP Cadence error: ${e}{/red-fg}`);
  }
  setTimeout(notifyCadenceCSP, (60 * 1000) / (Math.random() * randomness + cadence));
};

// Simulate Cycling Power - Broadcasting Power and Cadence & Speed
// This setup is NOT ideal. Cadence and Speed changes will be erratic
//   - takes ~2 sec to stabilize and be reflected in output
//   - will be unable to inject randomness into the output
//   - will need help on how to improve it
var notifyCPCS = function () {
  // https://www.hackster.io/neal_markham/ble-bicycle-speed-sensor-f60b80
  var spd_int = Math.round(
    (wheel_circumference * powerMeterSpeedUnit * 60 * 60) / (1000 * 1000 * powerMeterSpeed)
  );
  watts = power > 0 ? Math.floor(Math.random() * randomness + power) : 0;
  var cad_int = Math.round((60 * 1024) / cadence);
  var cad_time = 0;

  wheel_count += 1;
  if (powerMeterSpeed <= 0) {
    powerMeterSpeed = 0;
    setTimeout(notifyCPCS, notificationInterval);
    return;
  }

  if (cad_int != prevCadInt) {
    cad_time = (stroke_count * cad_int) % 65536;
    var deltaCadTime = cad_time - prevCadTime;
    var ratioCadTime = deltaCadTime / cad_int;
    if (ratioCadTime > 1) {
      stroke_count = stroke_count + Math.round(ratioCadTime);
      cad_time = (cad_time + cad_int) % 65536;
      prevCadTime = cad_time;
    }
  } else {
    stroke_count += 1;
    cad_time = (stroke_count * cad_int) % 65536;
  }

  prevCadTime = cad_time;
  prevCadInt = cad_int;

  if (cadence <= 0) {
    cadence = 0;
    setTimeout(notifyCPCS, notificationInterval);
    return;
  }

  try {
    zwackBLE.notifyCSP({
      watts: watts,
      rev_count: stroke_count,
      wheel_count: wheel_count,
      spd_int: spd_int,
      cad_int: cad_int,
      cad_time: cad_time,
      cadence: cadence,
      powerMeterSpeed: powerMeterSpeed,
    });
  } catch (e) {
    log(`{red-fg}CPCS error: ${e}{/red-fg}`);
  }
  setTimeout(notifyCPCS, notificationInterval);
};

let prepareRunningData = function () {
  this.notifyRunningSpeed = toMetersPerSecond(runningSpeed);
  this.notifyRunningCadence =
    runningCadence > 0 ? Math.floor((Math.random() - 0.5) * 3) + runningCadence : 0;
  this.notifyRunningIncline = runningIncline;
};

let notifyRSC = function () {
  prepareRunningData();
  try {
    zwackBLE.notifyRSC({ speed: notifyRunningSpeed, cadence: notifyRunningCadence });
  } catch (e) {
    log(`{red-fg}RSC error: ${e}{/red-fg}`);
  }
  setTimeout(notifyRSC, notificationInterval);
};

let notifyHeartRate = function () {
  const heartRate = hr > 89 ? Math.floor(hr + hrNoise) : undefined;
  try {
    zwackBLE.notifyHeartRate({ heart_rate: heartRate });
  } catch (e) {
    log(`{red-fg}HR error: ${e}{/red-fg}`);
  }
  setTimeout(notifyHeartRate, notificationInterval);
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function speedToPace(speed) {
  if (speed === 0) return "00:00";
  let t = 60 / speed;
  let minutes = Math.floor(t);
  let seconds = Math.floor((t - minutes) * 60);
  return minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
}

function toMetersPerSecond(speed) {
  return (speed * (metric ? 1 : 1.60934)) / 3.6;
}

// ─── Intercept debug output and route to log panel ─────────────────────────

// Override debug's log function to route to our blessed log panel
const debugLib = require("debug");
debugLib.log = function (...args) {
  const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  log(msg);
};

// ─── Main ──────────────────────────────────────────────────────────────────

renderServices();
renderShortcuts();
renderValues();

log(`Sensor: {bold}${sensorName}{/bold}`);
log(`Services: ${args.variable}`);

if (containsCSP && containsPWR && !containsCAD && !containsSPD) {
  log("Starting CSP — power only");
  notifyPowerCSP();
}
if (containsCSP && containsPWR && containsCAD && !containsSPD) {
  log("Starting CSP — power + cadence");
  notifyCadenceCSP();
}
if (containsCSP && containsPWR && containsCAD && containsSPD) {
  log("Starting CSP — power + cadence + speed");
  notifyCPCS();
}
if (containsFTMSBike) {
  log("Starting FTMS Bike — power + speed");
  notifyBikeFTMS();
}
if (containsFTMSTreadmill || containsRSC) {
  prepareRunningData();
}
if (containsFTMSBike || containsFTMSTreadmill || containsHR) {
  updateHeartRate();
}
if (containsFTMSTreadmill) {
  log("Starting FTMS Treadmill — speed + incline");
  notifyTreadmillFTMS();
}
if (containsFTMSRow) {
  log("Starting FTMS Rower — stroke rate");
  notifyRowFTMS();
}
if (containsRSC) {
  log("Starting RSC — speed + cadence");
  notifyRSC();
}
if (containsHR) {
  log("Starting Heart Rate");
  notifyHeartRate();
}
if (containsFTMSControl) {
  log("FTMS Control Point {green-fg}enabled{/green-fg}");
}

// Periodic refresh of values display
setInterval(refreshScreen, 1000);

screen.render();
