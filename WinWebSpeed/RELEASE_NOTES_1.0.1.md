# Release Notes v1.0.1

## What's New

### 🐛 Bug Fixes
- **Smart Network Selection**: Fixed an issue where download/upload speeds showed as 0. The app now intelligently selects the active internet connection (Ethernet or WiFi) instead of aggregating all interfaces.
- **Window Positioning**: Fixed the overlay "drifting" or jumping position after Sleep/Wake cycles or resolution changes. The window now automatically clamps to the visible screen area.
- **Registry Spam**: Removed excessive Registry writes during window dragging to improve system performance.

- **Initial Positioning**: Adjusted the default startup position on fresh installs to be tucked closer to the system tray (bottom-right), reducing the need for manual adjustment.

### ⚡ Optimizations
- **Reduced CPU Usage**: Optimized the process monitoring logic to scan for top processes less frequently (every 3s) while keeping real-time stats updating every second.

## Installation
1. Download `WinWebSpeed.exe` from the latest release.
2. Replace your existing executable.
