# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WinWebSpeed is an ultra-lightweight native Windows network and system monitor built with C# and WPF. It provides a transparent always-on-top overlay that displays real-time network speeds (download/upload), CPU usage, RAM usage, and GPU usage with top process identification for each metric.

**Key Technologies:**
- .NET 8.0 / WPF (Windows Presentation Foundation)
- Windows Performance Counters and WMI for system metrics
- Single-file executable deployment
- System tray integration with NotifyIcon

## Build Commands

### Development Build
```bash
dotnet restore
dotnet build --configuration Debug
```

### Release Build (Single-File Executable)
```bash
dotnet publish --configuration Release --runtime win-x64 --self-contained false /p:PublishSingleFile=true
```

The output will be at: `bin/Release/net8.0-windows/win-x64/publish/WinWebSpeed.exe`

### Run from Source
```bash
dotnet run --configuration Debug
```

## Architecture

### Core Components

**MainWindow.xaml.cs** - Main application window and orchestration logic
- Implements two separate DispatcherTimers with different priorities:
  - `_statsTimer`: High-priority (default) timer for accurate statistics updates (1000ms interval)
  - `_topmostTimer`: Low-priority (ApplicationIdle) timer for keeping window on top (500ms interval)
- Uses Win32 P/Invoke for:
  - `SetWindowPos()` to maintain always-on-top behavior
  - `GlobalMemoryStatusEx()` for RAM metrics
  - `SetWindowLong()` to hide from Alt+Tab (WS_EX_TOOLWINDOW)
- Network monitoring: Detects primary active interface with gateway, falls back to aggregated stats
- Process monitoring optimization: Full process scans throttled to every 3 timer ticks to reduce CPU overhead
- GPU monitoring: Uses Performance Counters (GPU Engine category) with WMI fallback, tracks per-process GPU usage

**Settings.cs** - User preferences persistence
- Stores all settings in Windows Registry at `HKEY_CURRENT_USER\Software\WinWebSpeed`
- Manages window position, theme, visibility toggles, startup behavior, max speed, update preferences
- Theme system: 6 predefined themes with customizable colors (text, bar, label)

**UpdateChecker.cs** - GitHub Releases integration
- Queries `https://api.github.com/repos/seppelz/winwebspeed/releases/latest`
- Semantic version comparison logic
- Automatic update notifications via system tray balloon tips

**App.xaml.cs** - Application entry point
- Implements single-instance enforcement using Named Mutex (`WinWebSpeed_SingleInstance_Mutex`)

### UI Architecture

The overlay window uses a transparent WPF window with `WindowStyle="None"` and `AllowsTransparency="True"`. Layout is a dynamic Grid with column definitions that change based on visibility settings:
- Columns 0-2: Download and Upload (always visible)
- Columns 4-8: CPU, GPU, RAM (dynamically positioned based on visibility flags)
- Window width auto-adjusts: Base 260px + 130px per visible system stat

### Performance Counter Strategy

1. **CPU**: `Processor` category, `% Processor Time`, `_Total` instance
2. **RAM**: Direct Win32 API call (`GlobalMemoryStatusEx`) for efficiency
3. **GPU**: Multi-category fallback approach:
   - Primary: `GPU Engine` category with instance filtering (engtype_3D, engtype_Compute, etc.)
   - Fallback: `GPU Adapter Memory` or `GPU Process Engine` categories
   - Last resort: WMI queries (Win32_VideoController)
   - Aggregates per-process GPU usage by extracting PID from instance names (format: `pid_<pid>_luid_<luid>_...`)

### Settings Persistence

Settings are stored in the Windows Registry and include:
- Window position (WindowX, WindowY)
- Speed unit preference (Bytes vs Bits)
- Max speed for progress bar scaling (10-1000 Mbit/s)
- Theme selection
- Visibility toggles for CPU/RAM/GPU
- Run at startup flag
- Auto-update preferences

## Version Management

Version is defined in **WinWebSpeed.csproj**:
```xml
<Version>1.0.1</Version>
<AssemblyVersion>1.0.1.0</AssemblyVersion>
<FileVersion>1.0.1.0</FileVersion>
```

When updating versions:
1. Update all three version fields in .csproj
2. Follow semantic versioning (MAJOR.MINOR.PATCH)
3. Rebuild and test the release build
4. Create GitHub release with tag format `v1.0.1`

## Embedded Resources

Logo files (`logo.ico` and `logo.png`) are embedded as resources in the assembly for single-file deployment. The tray icon loading logic tries multiple resource name patterns and falls back to file system for development builds.

## Known Implementation Details

1. **Timer Priority Issue Fix**: The dual-timer architecture (lines 67-78 in MainWindow.xaml.cs) prevents UI freezing by segregating critical statistics updates from non-critical window management.

2. **Network Interface Selection**: The app detects the primary internet-facing interface by checking for gateway addresses and operational status. It re-scans on `NetworkAddressChanged` events.

3. **Process Memory Management**: Process handles are explicitly disposed in a using statement within the loop to prevent handle leaks when enumerating processes.

4. **Window Position Persistence**: Position is saved only after drag-drop completes, not on every LocationChanged event, to avoid excessive registry writes.

5. **Display Settings Handling**: The app subscribes to `SystemEvents.DisplaySettingsChanged` to reposition the window when screen resolution changes or monitors are added/removed.

## Release Process

See **RELEASE_GUIDE.md** for complete release workflow. Key steps:
1. Update version in WinWebSpeed.csproj
2. Build release executable with publish command
3. Calculate SHA256 hash for winget manifest
4. Create GitHub release with tag and upload executable
5. Verify auto-update notifications work

## Code Signing

The project includes documentation for optional code signing (CODE_SIGNING_GUIDE.md, AFFORDABLE_CODE_SIGNING.md). Code signing is not required but reduces Windows SmartScreen warnings.
