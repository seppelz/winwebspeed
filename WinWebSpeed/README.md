# WinWebSpeed

<div align="center">

![WinWebSpeed](logo.png)

**Ultra-lightweight native Windows network and system monitor**

[![GitHub release](https://img.shields.io/github/v/release/seppelz/winwebspeed?style=flat-square)](https://github.com/seppelz/winwebspeed/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-blue?style=flat-square&logo=windows)](https://www.microsoft.com/windows)

[🌐 Website](https://seppelz.github.io/winwebspeed) • [📥 Download](https://github.com/seppelz/winwebspeed/releases/latest) • [🐛 Report Bug](https://github.com/seppelz/winwebspeed/issues) • [💡 Request Feature](https://github.com/seppelz/winwebspeed/issues)

</div>

---

## ✨ Features

- **📊 Real-time Network Monitoring** - Live download/upload speeds with visual progress bars
- **💻 CPU & RAM Usage** - Monitor system resources with top process identification
- **🎨 Customizable Themes** - 6 built-in themes (Orange, Blue, Green, Purple, Red, Cyan)
- **📏 Flexible Units** - Switch between Bytes/s (KB/s, MB/s) and Bits/s (Kbit/s, Mbit/s)
- **⚙️ Configurable Max Speed** - Set custom max speed for progress bar scaling (10-1000 Mbit/s)
- **🔔 Update Notifications** - Automatic update checking with GitHub Releases integration
- **🚀 Run at Startup** - Optional auto-start with Windows
- **📱 System Tray Integration** - Minimize to tray, right-click for options
- **🪟 Always on Top** - Transparent overlay window that stays visible
- **🖱️ Drag to Move** - Reposition the window anywhere on your screen
- **💾 Settings Persistence** - All preferences saved automatically

## 📸 Screenshots

*Screenshots coming soon - add your own!*

## 🚀 Quick Start

### Download

1. Go to [Releases](https://github.com/seppelz/winwebspeed/releases/latest)
2. Download `WinWebSpeed.exe`
3. Run it - no installation required!

### Installation via winget (Coming Soon)

```bash
winget install seppelz.WinWebSpeed
```

## 📋 Requirements

- **Windows 10** or **Windows 11**
- **.NET 8.0 Runtime** (usually pre-installed on Windows 11, or [download here](https://dotnet.microsoft.com/download/dotnet/8.0))

## 🎮 Usage

1. **Launch** - Run `WinWebSpeed.exe`
2. **Monitor** - The overlay window shows real-time network speeds, CPU, and RAM usage
3. **Configure** - Right-click the system tray icon to access:
   - Speed Unit (Bytes/s or Bits/s)
   - Max Speed setting
   - Theme selection
   - Show/Hide CPU and RAM
   - Run at Startup toggle
   - Check for Updates
   - Auto-check for Updates toggle
4. **Move** - Click and drag the window to reposition it
5. **Minimize** - Click the X to minimize to system tray

## 🛠️ Building from Source

### Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Visual Studio 2022 or Visual Studio Code with C# extension

### Build Steps

```bash
# Clone the repository
git clone https://github.com/seppelz/winwebspeed.git
cd winwebspeed/WinWebSpeed

# Restore dependencies
dotnet restore

# Build the project
dotnet build --configuration Release

# Publish single-file executable
dotnet publish --configuration Release --runtime win-x64 --self-contained false /p:PublishSingleFile=true
```

The executable will be in `bin/Release/net8.0-windows/win-x64/publish/WinWebSpeed.exe`

## 🎨 Customization

### Themes

Choose from 6 built-in themes:
- **Orange** (default)
- **Blue**
- **Green**
- **Purple**
- **Red**
- **Cyan**

Access themes via: System Tray → Themes

### Speed Units

- **Bytes/s**: Displays as KB/s, MB/s, GB/s
- **Bits/s**: Displays as Kbit/s, Mbit/s, Gbit/s

Switch via: System Tray → Speed Unit

### Max Speed

Configure the maximum speed for progress bar scaling:
- Options: 10, 25, 50, 100, 250, 500, 1000 Mbit/s
- Default: 100 Mbit/s

Set via: System Tray → Max Speed

## 🔧 Technical Details

- **Language**: C# (.NET 8.0)
- **Framework**: WPF (Windows Presentation Foundation)
- **Size**: ~1.8 MB (single-file executable)
- **Architecture**: Native Windows application
- **Update System**: GitHub Releases API integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [.NET](https://dotnet.microsoft.com/)
- Icons and UI inspired by modern design principles
- Thanks to all contributors and users!

## 📞 Support

- **Website**: [seppelz.github.io/winwebspeed](https://seppelz.github.io/winwebspeed)
- **Issues**: [GitHub Issues](https://github.com/seppelz/winwebspeed/issues)
- **Donations**: [Ko-fi](https://ko-fi.com/seppelz)

---

<div align="center">

Made with ❤️ by [seppelz](https://github.com/seppelz)

⭐ Star this repo if you find it useful!

</div>





