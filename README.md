# Zwack BLE

Simulate/Implement a Bluetooth Low Energy sensor that can send:

  * Cycling Power and Cadence (CSP Bluetooth profile)
  * Running Speed and Cadence (RSC Bluetooth profile)
  * Cycling Power and Cadence (FTMS Bluetooth profile - partial support)
  * Running Speed (FTMS Bluetooth profile - partial support)
  * Rowing Data (FTMS Bluetooth profile - partial support)
  * Heart rate (HR Bluetooth profile - and static battery)

Zwack has many possible uses, here are some examples:

  * Simulate an indoor bike trainer (turbo) generating cyclist power,cadence & speed data to test virtual indoor bike apps. 
  * Simulate a runner's speed and pace to test virtual indoor run apps.
  * Simulate a rower's stroke rate (and computed metrics) to test virtual indoor row apps 
  * Integrate a common treadmill with Zwift, sending data from the treadmill to the Zwift game via bluetooth
  * Simulate an indoor bike trainer (turbo) that is able to receive SetTarget (wattage) commands from test bike fitness apps (eg: BreakAway: Indoor Training) for testing. (This method is currently using the Cycling Power Profile with the addition of Wahoo's extension)
  
# Supports

At this time Zwack runs succesfuly on Mac OSX (Please check Requirements below) and Raspberry PI. Should run on Windows but it hasn't been tested. If it works let me know.

If running on a RPI, I've (@agrath) successfully used a model 4B in 2025. Check the nodeBLE docs regarding stopping the built in services, restarting hci0 and granting permission to node. Commands below copied with no context :)

```
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
sudo service bluetooth status
sudo systemctl status bluetooth
sudo service bluetooth stop
sudo systemctl stop bluetooth
sudo update-rc.d bluetooth remove
sudo systemctl disable bluetooth
sudo hciconfig hci0 up
```

You must run `hciconfig hci0 up` after each reboot or the service will not advertise

# Installation

clone this repo and run `npm install`

You may need to install Xcode on Mac to compile the `bleno` Bluetooth module. 

# Debug Flags

You can see a lot of debug information if you run the simulator or your app with the DEBUG environment variable set to 

  * csp  - Cycling Power and Cadence messages
  * rsc  - Running Speed and Cadence messages
  * ftms - Fitness Machine Messages
  * ble  - Bluetooth low energy messages
  * hr - HR messages

Example:

    DEBUG=rsc npm run simulator
    DEBUG=* npm run simulator

You'll see something similar to this

```
rsc [Zwack notifyRSC] {"speed":4.4703888888888885,"cadence":180} +0ms
rsc Running Speed: 4.4703888888888885 +2ms
rsc Running Cadence: 180 +0ms
rsc [Zwack notifyRSC] {"speed":4.4703888888888885,"cadence":180} +1s
rsc Running Speed: 4.4703888888888885 +0ms
```

# Using the simulator

Start the simulator using a preset:

    npm run bike
    npm run treadmill
    npm run rower

Or with individual services:

    npm run simulator -- --enabled ftms-bike ftms-control csp power cadence speed heartrate

The legacy `--variable=` syntax is still supported for backward compatibility.

On a different machine start your fitness app, bike computer or indoor virtual bike simulation software, like Zwift, and pair up the Zwack BLE sensor. The sensor name should be `Zwack`, it may have some numbers added to the name or you may see the host name of the computer running zwack. It all depends on the operating system you're uing to run Zwack.

If your indoor biking software does not detect the BLE sensor, disable, then enable, the Bluetooth on the machine where Zwack is running and retry to discover and connect to the sensor again.

The ZwackBLE sensor may show up as `Zwack` or has the host name of the machine running Zwack. This is normal.

Updating simulation parameters

    List of Available Keys
      c/C - Decrease/Increase cadence
      p/P - Decrease/Increase power
      s/S - Decrease/Increase running/cycling speed
      d/D - Decrease/Increase running cadence  

      r/R - Decrease/Increase parameter variability
      i/I - Decrease/Increase parameter increment
      x/q - Exit

Pressing `c` on your keyboard will decrease the cadence, conversly pressing `C` (upper case) will increase simulated cadence. Same thing for power by pressing `p` or `P`.
 
The variability parameter will introduce some random variability to the cadence and power values, so they don't remain constant all the time. If you lower the variability to `0` the cadence and power values will remain constant.

There are more keybindings reported in the output log

Press `x` or `q` to exit Zwack.

# Command Line Arguments

  ## Presets

  Presets provide a quick way to start common configurations:

  | Preset | Command | Services |
  |--------|---------|----------|
  | Bike | `npm run bike` | ftms-bike, ftms-control, csp, power, cadence, speed, heartrate |
  | Treadmill | `npm run treadmill` | ftms-treadmill, ftms-control, rsc, metric, heartrate |
  | Rower | `npm run rower` | ftms-row, ftms-control, heartrate |

  ## Custom Configuration

  Use `--enabled` to specify individual services:

  ```
  npm run simulator -- --enabled ftms-bike ftms-control csp power cadence heartrate
  ```

  Or use `--preset` with additional services:

  ```
  npm run simulator -- --preset bike --enabled metric
  ```

  ## Available Services

  | Service | Description |
  |---------|-------------|
  | ftms-bike | FTMS Indoor Bike Data (0x2AD2) |
  | ftms-treadmill | FTMS Treadmill Data (0x2ACD) |
  | ftms-row | FTMS Rower Data (0x2AD1) |
  | ftms-control | FTMS Control Point (0x2AD9) and Machine Status (0x2ADA) |
  | csp | Cycling Power Service |
  | rsc | Running Speed and Cadence Service |
  | power | CSP with Power data |
  | cadence | CSP with Cadence data (combine with `power`) |
  | speed | CSP with Speed data (combine with `power` and `cadence`) |
  | heartrate | Heart Rate service with BPM data (and battery at 75%) |
  | metric | Use metric units for running speed (km/h instead of mph) |
    
# Requirements

Requires NodeJS, and should run in all Bleno (the base BLE module) supported platforms, which are Mac, Windows or Raspberry Pi. 

Zwack cannot run on the same computer as the fitness or virtual indoor bike app, you'll need to run them on different systems.

If you have trouble getting BLE to work on MacOS, you can try to install bleno from [abandonware](https://github.com/abandonware/bleno) using the command

	npm install bleno@npm:@abandonware/bleno

## Help Needed

Currently this version of zwack is able to broadcast and simulate a FTMS (indoor bike specifically) profile as well as Cycling Power (which also broadcasts Speed). 
The current implementation of Cycling Power (with Speed & Cadence) is NOT ideal. Cadence and Speed changes will be erratic 
  * takes ~2 sec to stabilize and be reflected in output
  * will be unable to inject randomness into the output
  * will need help on how to improve it

## Bugs / Feature Enhancement needed

I'm sure there are many bugs but as of now, it works and suits the purpose which is for testing as there are no simulators available for bluetooth (similar in form to simulANT). 

## Credits

Initial prototype based on [ble-cycling-power](https://github.com/olympum/ble-cycling-power) code from olympum.

Codes for FTMS support is taken from the [FortuisANT project ](https://github.com/WouterJD/FortiusANT) and edited to fit usage as a simulator

Original zwack developed by @paixaop
Upstream changes integrated from @sirfergy, @johnnybui and @ciclozone

@agrath added treadmill data to FTMS, running incline, heartrate service plus upstream merge and tidyup, also added supported speed_range, inclination_range and rower support