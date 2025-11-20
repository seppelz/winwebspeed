# Temperature and Power Usage - Technical Information

## What's Possible with Our Tech Stack

### System Temperature
**Status**: ✅ **Possible, but with limitations**

The `systeminformation` library can access CPU temperature on Windows 11, but success depends on:

1. **Hardware Support**: Your ThinkPad with AMD processor should support this, but:
   - Requires proper drivers installed
   - Some systems may not expose temperature sensors to software
   - AMD processors on Windows sometimes have limited sensor access

2. **Administrative Privileges**: 
   - The library uses WMI (Windows Management Instrumentation) which may require admin rights
   - **Try running the app as Administrator** to see if temperature becomes available

3. **What We're Trying**:
   - Main CPU temperature
   - Maximum temperature
   - Individual core temperatures (using the highest)
   - Debug logging to see what data is actually available

### Power Consumption
**Status**: ⚠️ **Partially Possible**

Power consumption is more limited:

1. **Battery-Powered Devices (Laptops)**:
   - ✅ **Works when on battery** (discharging)
   - ⚠️ **May not work when plugged in** (charging)
   - Uses Windows Battery API which provides discharge rate

2. **Desktop Systems**:
   - ❌ **Not available** (no battery)
   - Would require external hardware power meter

3. **What We're Trying**:
   - `powerConsumption` property
   - `dischargeRate` property (when on battery)
   - Calculation from voltage × current (if available)
   - Alternative property names

## How to Check What's Available

### Enable Debug Logging

The app now includes debug logging. To see what data is available:

1. **Run the app in development mode** (not packaged):
   ```bash
   npm start
   ```

2. **Check the console output** - you'll see messages like:
   - `CPU temperature not available. Raw data: {...}`
   - `Battery data: {...}`
   - `Using powerConsumption property: X.X`

### What to Look For

**For Temperature:**
- If you see `CPU temperature not available`, check the raw data in the log
- Common issues:
  - Temperature returns `null` or `-1` (sensors not accessible)
  - Empty object `{}` (no sensor data)
  - Values that are clearly wrong (e.g., 0°C or 200°C)

**For Power:**
- Check the `Battery data:` log entry
- Look for:
  - `powerConsumption`: Direct power value (watts)
  - `dischargeRate`: Discharge rate (may be in milliwatts)
  - `current`: Current draw (may be in milliamps)
  - `voltage`: Battery voltage

## Troubleshooting Steps

### 1. Run as Administrator
- Right-click the app executable
- Select "Run as administrator"
- This grants access to WMI and hardware sensors

### 2. Check Battery Status
- **For power consumption**: Unplug your laptop and run on battery
- Power consumption is most accurate when discharging
- Some systems only report power when not charging

### 3. Update Drivers
- Ensure AMD chipset drivers are installed
- Update Windows to latest version
- Check Lenovo Vantage for ThinkPad-specific drivers

### 4. Verify Hardware Support
- Some ThinkPad models have better sensor support than others
- Check if other monitoring tools (HWiNFO, Core Temp) can read temperature
- If they can't, it's likely a hardware/driver limitation

## Limitations

### Temperature
- **AMD processors on Windows** sometimes have limited sensor access compared to Intel
- **Laptop sensors** may be restricted by BIOS/firmware
- **Virtual machines** won't have access to real hardware sensors

### Power Consumption
- **Only works on battery-powered devices** (laptops, tablets)
- **May not work when charging** (depends on system)
- **Not available on desktops** (would need external meter)
- **Accuracy varies** - software estimates may not be 100% accurate

## Alternative Solutions

If `systeminformation` doesn't work for your system:

1. **HWiNFO** - External tool that can read sensors (but can't integrate directly)
2. **Open Hardware Monitor** - .NET library (would require Node.js bridge)
3. **WMI Queries** - Direct Windows WMI access (more complex, may need admin)

## Current Implementation

The code now:
- ✅ Tries multiple temperature sources (main, max, cores)
- ✅ Tries multiple power consumption methods
- ✅ Logs debug information to help diagnose issues
- ✅ Handles null/undefined values gracefully
- ✅ Shows "--" when data is unavailable

## Next Steps

1. **Run the app** and check console logs
2. **Try running as Administrator**
3. **Unplug laptop** to test power consumption
4. **Check the debug logs** to see what data is actually available
5. **Report back** what you see in the logs - this will help determine if it's a limitation or a bug







