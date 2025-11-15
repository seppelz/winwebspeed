# WebSpeed - Windows Network Speed Monitor

A lightweight Windows application that monitors your network upload and download speeds in real-time, displaying them in the system tray.

## Features

- Real-time network speed monitoring (updates every 1 second)
- System tray icon with live speed display (↓ download ↑ upload in kbps)
- Detailed stats window on click
- Supports both WiFi and Ethernet connections
- Minimal resource usage
- Windows 11 compatible

## Installation

### Option 1: Installer (Recommended)
1. Download `WebSpeed Setup X.X.X.exe` from the `release` folder
2. Run the installer and follow the setup wizard
3. The app will start automatically and appear in your system tray

### Option 2: Portable Version
1. Download the portable version from the `release` folder
2. Extract and run `WebSpeed.exe` directly (no installation required)

## Building from Source

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Run in development mode
npm run dev

# Create Windows installer/portable executable
npm run dist:win
```

**Note for Windows builds**: The build creates both an NSIS installer and a portable executable. If you encounter code signing extraction errors:
1. Run the terminal as Administrator (recommended for NSIS installer)
2. Or use the portable `.exe` file which doesn't require code signing

## Usage

- The app runs in the background and displays speeds in the system tray tooltip
- Click the tray icon to open/close the detailed stats window
- Right-click the tray icon for options (Exit, etc.)

## Requirements

- Windows 10/11
- Node.js 18+ (for development)

## Notes

- **Icon**: The `assets/icon.ico` file is a placeholder. For production, replace it with a proper Windows .ico file (recommended sizes: 16x16, 32x32, 48x48, 256x256). You can create one using online tools or image editing software.

## License

MIT

