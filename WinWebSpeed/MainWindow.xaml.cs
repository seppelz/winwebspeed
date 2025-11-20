﻿using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Net.NetworkInformation;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Win32;
using WinForms = System.Windows.Forms;

namespace WinWebSpeed;

public partial class MainWindow : Window
{
    // High-priority timer for time-sensitive statistics
    private readonly DispatcherTimer _statsTimer;
    private DateTime _lastTickTime = DateTime.Now;


    // Low-priority timer for non-critical UI updates (staying on top)
    private readonly DispatcherTimer _topmostTimer;

    private NetworkInterface? _activeInterface;
    private long _prevBytesReceived;
    private long _prevBytesSent;
    private const int UpdateInterval = 1000; // 1 second

    private long _currentDownloadSpeed;
    private long _currentUploadSpeed;

    private WinForms.NotifyIcon? _notifyIcon;
    private readonly Settings _settings;
    private Theme _currentTheme;
    private int _maxSpeed = 100;
    private const string RegistryKeyName = "WinWebSpeed";
    private string? _pendingUpdateUrl;

    private System.Diagnostics.PerformanceCounter? _cpuCounter;
    private readonly Dictionary<int, TimeSpan> _prevProcessorTimes = new();
    private DateTime _prevTime = DateTime.Now;

    public MainWindow()
    {
        InitializeComponent();

        _settings = Settings.Load();
        _currentTheme = Theme.GetTheme(_settings.ThemeName);
        _maxSpeed = _settings.MaxSpeed;

        // *** THE CORE FIX IS HERE ***

        // 1. Initialize the high-priority timer for statistics.
        // This runs at the default priority to ensure accurate timing.
        _statsTimer = new DispatcherTimer();

        // 2. Initialize the low-priority timer for keeping the window on top.
        // Setting the priority to ApplicationIdle is crucial. It tells the dispatcher
        // to only run this timer when the UI thread isn't busy with more important
        // tasks, like the _statsTimer.
        _topmostTimer = new DispatcherTimer(DispatcherPriority.ApplicationIdle, Dispatcher);

        // *** END OF FIX ***

        InitializeTrayIcon();
        InitializePerformanceCounters();
        Loaded += MainWindow_Loaded;
        LocationChanged += MainWindow_LocationChanged;

        if (!double.IsNaN(_settings.WindowX) && !double.IsNaN(_settings.WindowY))
        {
            Left = _settings.WindowX;
            Top = _settings.WindowY;
        }
        else
        {
            var workingArea = SystemParameters.WorkArea;
            Left = workingArea.Right - Width - 10;
            Top = workingArea.Bottom - Height - 10;
        }

        ApplyTheme(_currentTheme);
    }

    private void MainWindow_LocationChanged(object? sender, EventArgs e)
    {
        _settings.WindowX = Left;
        _settings.WindowY = Top;
        _settings.Save();
    }

    private void InitializePerformanceCounters()
    {
        try
        {
            _cpuCounter = new System.Diagnostics.PerformanceCounter("Processor", "% Processor Time", "_Total");
            _cpuCounter.NextValue(); // First call returns 0
        }
        catch { /* Handle permission issues */ }
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    private static readonly IntPtr HwndTopmost = new(-1);
    private const uint SwpNosize = 0x0001;
    private const uint SwpNomove = 0x0002;
    private const uint SwpNoactivate = 0x0010;

    private void ForceTopMost()
    {
        try
        {
            if (!IsLoaded || !IsVisible) return;
            var hWnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            if (hWnd != IntPtr.Zero)
            {
                SetWindowPos(hWnd, HwndTopmost, 0, 0, 0, 0, SwpNosize | SwpNomove | SwpNoactivate);
            }
        }
        catch { /* Ignored */ }
    }

    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx lpBuffer);

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    private struct MemoryStatusEx
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
        public void Init() => dwLength = (uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(MemoryStatusEx));
    }

    private void InitializeTrayIcon()
    {
        _notifyIcon = new WinForms.NotifyIcon();
        
        var icoPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logo.ico");
        if (System.IO.File.Exists(icoPath))
        {
            try 
            {
                using var fileStream = new System.IO.FileStream(icoPath, System.IO.FileMode.Open, System.IO.FileAccess.Read);
                _notifyIcon.Icon = new System.Drawing.Icon(fileStream);
            }
            catch { LoadIconFromPng(); }
        }
        else { LoadIconFromPng(); }
        
        if (_notifyIcon.Icon == null) { _notifyIcon.Icon = System.Drawing.SystemIcons.Application; }

        _notifyIcon.Visible = true;
        _notifyIcon.Text = "WinWebSpeed";
        _notifyIcon.BalloonTipClicked += (s, e) =>
        {
            if (_pendingUpdateUrl != null)
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = _pendingUpdateUrl, UseShellExecute = true });
                _pendingUpdateUrl = null;
            }
        };

        var contextMenu = new WinForms.ContextMenuStrip();
        var unitItem = new WinForms.ToolStripMenuItem("Speed Unit");
        var bytesItem = new WinForms.ToolStripMenuItem("Bytes/s (KB/s, MB/s)", null, (s, e) => SetUnit(SpeedUnit.Bytes)) { Checked = _settings.SpeedUnit == SpeedUnit.Bytes };
        var bitsItem = new WinForms.ToolStripMenuItem("Bits/s (Kbit/s, Mbit/s)", null, (s, e) => SetUnit(SpeedUnit.Bits)) { Checked = _settings.SpeedUnit == SpeedUnit.Bits };
        unitItem.DropDownItems.AddRange(new WinForms.ToolStripItem[] { bytesItem, bitsItem });
        contextMenu.Items.Add(unitItem);

        var maxSpeedItem = new WinForms.ToolStripMenuItem("Max Speed");
        int[] speeds = { 10, 25, 50, 100, 250, 500, 1000 };
        foreach (var speed in speeds)
        {
            maxSpeedItem.DropDownItems.Add(new WinForms.ToolStripMenuItem($"{speed} Mbit/s", null, (s, e) => SetMaxSpeed(speed)) { Checked = _maxSpeed == speed });
        }
        contextMenu.Items.Add(maxSpeedItem);

        var themeItem = new WinForms.ToolStripMenuItem("Themes");
        foreach (var theme in Theme.PredefinedThemes)
        {
            themeItem.DropDownItems.Add(new WinForms.ToolStripMenuItem(theme.Name, null, (s, e) => SetTheme(theme.Name)) { Checked = _settings.ThemeName == theme.Name });
        }
        contextMenu.Items.Add(themeItem);
        contextMenu.Items.Add(new WinForms.ToolStripSeparator());
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Show CPU", null, (s, e) => ToggleCpu()) { Checked = _settings.ShowCpu, Name = "cpuItem" });
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Show RAM", null, (s, e) => ToggleRam()) { Checked = _settings.ShowRam, Name = "ramItem" });
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Run at Startup", null, (s, e) => ToggleStartup()) { Checked = _settings.RunAtStartup, Name = "startupItem" });
        contextMenu.Items.Add(new WinForms.ToolStripSeparator());
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Check for Updates", null, (s, e) => CheckForUpdates(true)) { Name = "updateItem" });
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Auto-check for Updates", null, (s, e) => ToggleAutoUpdate()) { Checked = _settings.CheckForUpdates, Name = "autoUpdateItem" });
        contextMenu.Items.Add(new WinForms.ToolStripSeparator());
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Exit", null, (s, e) => Close()));
        _notifyIcon.ContextMenuStrip = contextMenu;
    }
    
    private void LoadIconFromPng()
    {
        var pngPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logo.png");
        if (System.IO.File.Exists(pngPath))
        {
            try 
            {
                using var bitmap = new System.Drawing.Bitmap(pngPath);
                _notifyIcon!.Icon = System.Drawing.Icon.FromHandle(bitmap.GetHicon());
            }
            catch { /* Ignored */ }
        }
    }

    private void SetTheme(string themeName)
    {
        _currentTheme = Theme.GetTheme(themeName);
        _settings.ThemeName = themeName;
        _settings.Save();
        ApplyTheme(_currentTheme);
        
        if (_notifyIcon?.ContextMenuStrip?.Items.OfType<WinForms.ToolStripMenuItem>().FirstOrDefault(x => x.Text == "Themes") is { } themeMenu)
        {
            foreach (WinForms.ToolStripMenuItem item in themeMenu.DropDownItems) { item.Checked = item.Text == themeName; }
        }
    }

    private void SetMaxSpeed(int speed)
    {
        _maxSpeed = speed;
        _settings.MaxSpeed = speed;
        _settings.Save();
        
        if (_notifyIcon?.ContextMenuStrip?.Items.OfType<WinForms.ToolStripMenuItem>().FirstOrDefault(x => x.Text == "Max Speed") is { } maxSpeedMenu)
        {
            foreach (WinForms.ToolStripMenuItem item in maxSpeedMenu.DropDownItems) { item.Checked = item.Text == $"{speed} Mbit/s"; }
        }
    }

    private void ToggleCpu()
    {
        _settings.ShowCpu = !_settings.ShowCpu;
        _settings.Save();
        spCpu.Visibility = _settings.ShowCpu ? Visibility.Visible : Visibility.Collapsed;
        UpdateWindowWidth();
        if (_notifyIcon?.ContextMenuStrip?.Items["cpuItem"] is WinForms.ToolStripMenuItem cpuItem) { cpuItem.Checked = _settings.ShowCpu; }
    }

    private void ToggleRam()
    {
        _settings.ShowRam = !_settings.ShowRam;
        _settings.Save();
        spRam.Visibility = _settings.ShowRam ? Visibility.Visible : Visibility.Collapsed;
        UpdateWindowWidth();
        if (_notifyIcon?.ContextMenuStrip?.Items["ramItem"] is WinForms.ToolStripMenuItem ramItem) { ramItem.Checked = _settings.ShowRam; }
    }

    private void UpdateWindowWidth()
    {
        Width = 260 + (_settings.ShowCpu ? 130 : 0) + (_settings.ShowRam ? 130 : 0);
    }

    private void SetUnit(SpeedUnit unit)
    {
        _settings.SpeedUnit = unit;
        _settings.Save();
        UpdateSpeedDisplay(_currentDownloadSpeed, _currentUploadSpeed);
        
        if (_notifyIcon?.ContextMenuStrip?.Items.OfType<WinForms.ToolStripMenuItem>().FirstOrDefault(x => x.Text == "Speed Unit") is { } unitMenu)
        {
            foreach (WinForms.ToolStripMenuItem item in unitMenu.DropDownItems)
            {
                if (item.Text == null) continue;
                item.Checked = (item.Text.Contains("Bytes") && unit == SpeedUnit.Bytes) || (item.Text.Contains("Bits") && unit == SpeedUnit.Bits);
            }
        }
    }

    private void ToggleStartup()
    {
        _settings.RunAtStartup = !_settings.RunAtStartup;
        _settings.Save();
        
        using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
        if (key == null) return;

        var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
        if (_settings.RunAtStartup && !string.IsNullOrEmpty(exePath))
        {
            key.SetValue(RegistryKeyName, exePath);
        }
        else
        {
            key.DeleteValue(RegistryKeyName, false);
        }
        
        if (_notifyIcon?.ContextMenuStrip?.Items["startupItem"] is WinForms.ToolStripMenuItem startupItem) { startupItem.Checked = _settings.RunAtStartup; }
    }

    private void ToggleAutoUpdate()
    {
        _settings.CheckForUpdates = !_settings.CheckForUpdates;
        _settings.Save();
        if (_notifyIcon?.ContextMenuStrip?.Items["autoUpdateItem"] is WinForms.ToolStripMenuItem autoUpdateItem) { autoUpdateItem.Checked = _settings.CheckForUpdates; }
    }

    private async void CheckForUpdates(bool showNoUpdateMessage)
    {
        try
        {
            var version = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
            var currentVersion = version != null ? $"{version.Major}.{version.Minor}.{version.Build}" : "1.0.0";
            var updateInfo = await UpdateChecker.CheckForUpdatesAsync(currentVersion);
            
            if (updateInfo == null)
            {
                if (showNoUpdateMessage) _notifyIcon?.ShowBalloonTip(5000, "WinWebSpeed", "Unable to check for updates.", WinForms.ToolTipIcon.Info);
                return;
            }

            _settings.LastUpdateCheck = DateTime.Now;
            _settings.Save();

            if (updateInfo.IsNewer)
            {
                _pendingUpdateUrl = updateInfo.DownloadUrl;
                _notifyIcon?.ShowBalloonTip(10000, "Update Available", $"WinWebSpeed {updateInfo.Version} is available! Click to download.", WinForms.ToolTipIcon.Info);
            }
            else if (showNoUpdateMessage)
            {
                _notifyIcon?.ShowBalloonTip(3000, "WinWebSpeed", "You are using the latest version.", WinForms.ToolTipIcon.Info);
            }
        }
        catch
        {
            if (showNoUpdateMessage) _notifyIcon?.ShowBalloonTip(5000, "WinWebSpeed", "Error checking for updates.", WinForms.ToolTipIcon.Warning);
        }
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        ForceTopMost();
        FindActiveInterface();
        UpdateSpeedDisplay(0, 0);
        
        spCpu.Visibility = _settings.ShowCpu ? Visibility.Visible : Visibility.Collapsed;
        spRam.Visibility = _settings.ShowRam ? Visibility.Visible : Visibility.Collapsed;
        UpdateWindowWidth();

        // Configure and start the high-priority stats timer
        _statsTimer.Interval = TimeSpan.FromMilliseconds(UpdateInterval);
        _statsTimer.Tick += StatsTimer_Tick;
        _statsTimer.Start();

        // Configure and start the low-priority topmost timer
        _topmostTimer.Interval = TimeSpan.FromMilliseconds(500);
        _topmostTimer.Tick += (s, ev) => ForceTopMost();
        _topmostTimer.Start();

        if (_settings.CheckForUpdates && (DateTime.Now - _settings.LastUpdateCheck).TotalDays >= 1)
        {
            Task.Delay(5000).ContinueWith(_ => CheckForUpdates(false), TaskScheduler.FromCurrentSynchronizationContext());
        }
    }

    private void FindActiveInterface()
    {
        try
        {
            var bestInterface = NetworkInterface.GetAllNetworkInterfaces()
                .Where(ni => ni.OperationalStatus == OperationalStatus.Up &&
                             ni.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                             ni.NetworkInterfaceType != NetworkInterfaceType.Tunnel &&
                             ni.Supports(NetworkInterfaceComponent.IPv4))
                .OrderByDescending(ni => ni.NetworkInterfaceType == NetworkInterfaceType.Ethernet || ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                .ThenByDescending(ni => ni.GetIPProperties().GetIPv4Properties().Index)
                .FirstOrDefault();

            if (bestInterface != null)
            {
                var stats = bestInterface.GetIPv4Statistics();
                _prevBytesReceived = stats.BytesReceived;
                _prevBytesSent = stats.BytesSent;
                _activeInterface = bestInterface;
            }
            else
            {
                _activeInterface = null;
            }
        }
        catch
        {
            _activeInterface = null;
        }
    }

    private void StatsTimer_Tick(object? sender, EventArgs e)
    {
        if (_activeInterface == null || _activeInterface.OperationalStatus != OperationalStatus.Up)
        {
            FindActiveInterface();
            if (_activeInterface == null)
            {
                txtDownload.Text = "No Network";
                txtUpload.Text = string.Empty;
                UpdateCpuRamDisplay();
                return;
            }
        }

        try
        {
            var stats = _activeInterface.GetIPv4Statistics();
            var currentBytesReceived = stats.BytesReceived;
            var currentBytesSent = stats.BytesSent;
            var now = DateTime.Now;

            // Calculate exact time passed since last tick (e.g., 1.05 seconds)
            double timeElapsed = (now - _lastTickTime).TotalSeconds;
            
            // Prevent division by zero or extremely small intervals on startup
            if (timeElapsed > 0)
            {
                // Calculate raw difference
                long bytesReceivedDiff = currentBytesReceived - _prevBytesReceived;
                long bytesSentDiff = currentBytesSent - _prevBytesSent;

                // Adjust purely for the time elapsed. 
                // If 100Mb came in 1.2 seconds, this results in 83Mb/s (Correct) 
                // instead of 100Mb/s (Incorrect).
                _currentDownloadSpeed = (long)(bytesReceivedDiff / timeElapsed);
                _currentUploadSpeed = (long)(bytesSentDiff / timeElapsed);
            }

            // Handle negative values (counter reset)
            if (_currentDownloadSpeed < 0) _currentDownloadSpeed = 0;
            if (_currentUploadSpeed < 0) _currentUploadSpeed = 0;

            _prevBytesReceived = currentBytesReceived;
            _prevBytesSent = currentBytesSent;
            _lastTickTime = now; // Reset time for next tick

            UpdateSpeedDisplay(_currentDownloadSpeed, _currentUploadSpeed);
            UpdateCpuRamDisplay();
        }
        catch
        {
            _activeInterface = null; 
        }
    }

    private void UpdateSpeedDisplay(long downloadBytes, long uploadBytes)
    {
        string FormatSpeed(long bytes, out double mbitValue)
        {
            mbitValue = (bytes * 8) / 1_000_000.0;

            if (_settings.SpeedUnit == SpeedUnit.Bits)
            {
                return $"{mbitValue:F1} Mbit/s";
            }
            
            if (bytes < 1_000_000) return $"{bytes / 1_000.0:F1} KB/s";
            return $"{bytes / 1_000_000.0:F1} MB/s";
        }

        txtDownload.Text = FormatSpeed(downloadBytes, out var downloadMbit);
        txtUpload.Text = FormatSpeed(uploadBytes, out var uploadMbit);

        pbDownload.Value = _maxSpeed > 0 ? Math.Min(downloadMbit / _maxSpeed * 100, 100) : 0;
        pbUpload.Value = _maxSpeed > 0 ? Math.Min(uploadMbit / _maxSpeed * 100, 100) : 0;
    }

    private void UpdateCpuRamDisplay()
    {
        if (_cpuCounter != null)
        {
            try
            {
                var cpuUsage = _cpuCounter.NextValue();
                txtCpu.Text = $"{cpuUsage:F1}%";
                txtTopCpu.Text = GetTopCpuProcess() ?? "-";
            }
            catch { /* ignored */ }
        }

        try
        {
            var memStatus = new MemoryStatusEx();
            memStatus.Init();
            if (GlobalMemoryStatusEx(ref memStatus))
            {
                txtRam.Text = $"{memStatus.dwMemoryLoad}%";
                txtTopRam.Text = GetTopRamProcess() ?? "-";
            }
        }
        catch { /* ignored */ }
    }

    private string? GetTopCpuProcess()
    {
        try
        {
            var elapsed = (DateTime.Now - _prevTime).TotalMilliseconds;
            if (elapsed < 500) return null; 

            string? topProcessName = null;
            double maxCpu = -1;

            var processes = System.Diagnostics.Process.GetProcesses();
            foreach (var process in processes)
            {
                try
                {
                    var pid = process.Id;
                    var currentProcessorTime = process.TotalProcessorTime;

                    if (_prevProcessorTimes.TryGetValue(pid, out var prevProcessorTime))
                    {
                        var cpuUsedMs = (currentProcessorTime - prevProcessorTime).TotalMilliseconds;
                        var cpuPercent = cpuUsedMs / (elapsed * Environment.ProcessorCount) * 100;
                        if (cpuPercent > maxCpu)
                        {
                            maxCpu = cpuPercent;
                            topProcessName = process.ProcessName;
                        }
                    }
                    _prevProcessorTimes[pid] = currentProcessorTime;
                }
                catch { /* Process may have exited */ }
            }
            _prevTime = DateTime.Now;
            return topProcessName;
        }
        catch { return null; }
    }

    private string? GetTopRamProcess()
    {
        try
        {
            return System.Diagnostics.Process.GetProcesses()
                .Where(p => { try { return !p.HasExited && p.WorkingSet64 > 0; } catch { return false; } })
                .OrderByDescending(p => { try { return p.WorkingSet64; } catch { return 0L; } })
                .Select(p => p.ProcessName)
                .FirstOrDefault();
        }
        catch { return null; }
    }

    private void ApplyTheme(Theme theme)
    {
        var textColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.TextColor)!;
        var barColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.BarColor)!;

        txtDownload.Foreground = textColor;
        txtUpload.Foreground = textColor;
        txtCpu.Foreground = textColor;
        txtRam.Foreground = textColor;
        pbDownload.Foreground = barColor;
        pbUpload.Foreground = barColor;
    }

    private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        _settings.WindowX = Left;
        _settings.WindowY = Top;
        _settings.Save();
        _notifyIcon?.Dispose();
        _cpuCounter?.Dispose();
        _statsTimer.Stop();
        _topmostTimer.Stop();
        base.OnClosing(e);
    }
}