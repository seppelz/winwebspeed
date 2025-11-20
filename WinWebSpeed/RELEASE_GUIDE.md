# Release Guide for WinWebSpeed

This guide explains how to create and publish a new release of WinWebSpeed.

## Prerequisites

1. Build the release executable (see Building from Source in README.md)
2. Have GitHub CLI (`gh`) installed, or use GitHub web interface
3. Ensure you're on the `main` branch with all changes committed

## Step-by-Step Release Process

### 1. Update Version Number

Update the version in `WinWebSpeed.csproj`:

```xml
<Version>1.0.0</Version>
<AssemblyVersion>1.0.0.0</AssemblyVersion>
<FileVersion>1.0.0.0</FileVersion>
```

### 2. Build the Release

```bash
cd WinWebSpeed
dotnet publish --configuration Release --runtime win-x64 --self-contained false /p:PublishSingleFile=true
```

The executable will be at: `bin/Release/net8.0-windows/win-x64/publish/WinWebSpeed.exe`

### 3. Test the Release

- Run the executable
- Test all features
- Verify update checking works
- Check system tray icon
- Test all menu options

### 4. Calculate SHA256 Hash (for winget)

```powershell
Get-FileHash -Path "bin\Release\net8.0-windows\win-x64\publish\WinWebSpeed.exe" -Algorithm SHA256
```

Copy the hash value for the winget manifest.

### 5. Create GitHub Release

#### Option A: Using GitHub CLI

```bash
# Create a tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push the tag
git push origin v1.0.0

# Create release with the executable
gh release create v1.0.0 "bin/Release/net8.0-windows/win-x64/publish/WinWebSpeed.exe" \
  --title "WinWebSpeed v1.0.0" \
  --notes "## What's New

- Initial release
- Real-time network speed monitoring
- CPU and RAM usage display
- Customizable themes
- System tray integration
- Automatic update notifications

## Download

Download \`WinWebSpeed.exe\` from the assets below."
```

#### Option B: Using GitHub Web Interface

1. Go to https://github.com/seppelz/winwebspeed/releases/new
2. **Tag version**: `v1.0.0` (create new tag)
3. **Release title**: `WinWebSpeed v1.0.0`
4. **Description**: Write release notes (see template below)
5. **Attach binaries**: Drag and drop `WinWebSpeed.exe`
6. Check **"Set as the latest release"**
7. Click **"Publish release"**

### 6. Release Notes Template

```markdown
## What's New in v1.0.0

### Features
- Real-time network speed monitoring (download/upload)
- CPU and RAM usage display with top process identification
- 6 customizable themes (Orange, Blue, Green, Purple, Red, Cyan)
- Flexible speed units (Bytes/s or Bits/s)
- Configurable max speed (10-1000 Mbit/s)
- System tray integration
- Always-on-top transparent overlay
- Run at startup option
- Automatic update notifications

### Technical
- Native C# WPF application
- .NET 8.0 runtime required
- Single-file executable (~1.8MB)
- Windows 10/11 compatible

## Installation

1. Download `WinWebSpeed.exe` from the assets below
2. Run the executable (no installation required)
3. The app will appear in your system tray

## Requirements

- Windows 10 or Windows 11
- .NET 8.0 Runtime (usually pre-installed on Windows 11)

## Support

- Report issues: https://github.com/seppelz/winwebspeed/issues
- Website: https://seppelz.github.io/winwebspeed
```

### 7. Update winget Manifest (Optional)

If you want to submit to Windows Package Manager:

1. Update `winget-manifest.yaml` with:
   - New version number
   - New download URL
   - SHA256 hash from step 4

2. Submit to winget-pkgs repository:
   - Fork https://github.com/microsoft/winget-pkgs
   - Create a PR with your manifest in the correct folder structure
   - Follow winget submission guidelines

### 8. Verify Release

1. Check the release page: https://github.com/seppelz/winwebspeed/releases
2. Test downloading the executable
3. Verify update notifications work in the app
4. Check that the website download link works

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

## Checklist

- [ ] Version updated in `.csproj`
- [ ] Code tested and working
- [ ] Release executable built
- [ ] SHA256 hash calculated
- [ ] Release notes written
- [ ] GitHub release created
- [ ] Executable uploaded to release
- [ ] Release marked as latest
- [ ] Update notifications tested
- [ ] Website download link verified

## Post-Release

1. Update README.md if needed
2. Announce on social media/forums (optional)
3. Monitor for issues and feedback
4. Plan next release





