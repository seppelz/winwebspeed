﻿using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Management;
using System.Net.NetworkInformation;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
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
    // private bool _isUserDraggingWindow; // Removed unused field

    private System.Diagnostics.PerformanceCounter? _cpuCounter;
    private readonly List<System.Diagnostics.PerformanceCounter> _gpuCounters = new();
    private readonly Dictionary<System.Diagnostics.PerformanceCounter, int> _gpuCounterToPid = new();
    private readonly Dictionary<int, double> _gpuUsageByPid = new();
    private bool _useWmiForGpu = false;
    private readonly Dictionary<int, TimeSpan> _prevProcessorTimes = new();
    private DateTime _prevTime = DateTime.Now;
    
    // Optimization: Only scan processes every N seconds
    private int _processUpdateTickCounter = 0;
    private const int ProcessUpdateIntervalTicks = 10; 

    // Network Selection
    private NetworkInterface? _primaryInterface;

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
        // Optimization: Don't save on every pixel move. 'Window_MouseLeftButtonDown' handles the save on drop.
        // LocationChanged += MainWindow_LocationChanged; 
        
        NetworkChange.NetworkAddressChanged += NetworkChange_NetworkAddressChanged;
        SystemEvents.DisplaySettingsChanged += SystemEvents_DisplaySettingsChanged;

        if (!double.IsNaN(_settings.WindowX) && !double.IsNaN(_settings.WindowY))
        {
            Left = _settings.WindowX;
            Top = _settings.WindowY;
        }
        else
        {
            var workingArea = SystemParameters.WorkArea;
            // Place strictly in the bottom-right corner, aligned with the tray area.
            // Adjust offsets if needed based on typical taskbar heights, but WorkArea usually excludes taskbar.
            // If the user wants it "in" the taskbar, we might need to go lower, but let's start with 0 offset from bottom.
            Left = workingArea.Right - Width - 5;
            Top = SystemParameters.FullPrimaryScreenHeight - Height; 
        }

        ApplyTheme(_currentTheme);
    }

    private void NetworkChange_NetworkAddressChanged(object? sender, EventArgs e)
    {
        // Offload to UI thread to avoid threading issues if we access UI or shared state
        Dispatcher.Invoke(UpdatePrimaryInterface);
    }

    private void SystemEvents_DisplaySettingsChanged(object? sender, EventArgs e)
    {
         Dispatcher.Invoke(EnsureWindowOnScreen);
    }
    
    private void EnsureWindowOnScreen()
    {
        // Allow positioning anywhere on screen, including in taskbar area.
        // Only prevent the window from going completely off-screen.
        var screenWidth = SystemParameters.FullPrimaryScreenWidth;
        var screenHeight = SystemParameters.FullPrimaryScreenHeight;

        // Ensure at least 50px of the window is visible on screen
        // This allows taskbar positioning while preventing completely off-screen windows
        if (Left > screenWidth - 50) Left = screenWidth - Width;
        if (Left < -Width + 50) Left = 0;
        if (Top > screenHeight - 20) Top = screenHeight - Height;
        if (Top < -Height + 20) Top = 0;

        PersistWindowPosition();
    }

    private void InitializePerformanceCounters()
    {
        try
        {
            _cpuCounter = new System.Diagnostics.PerformanceCounter("Processor", "% Processor Time", "_Total");
            _cpuCounter.NextValue(); // First call returns 0
        }
        catch { /* Handle permission issues */ }

        // Initialize GPU counters - aggregate all GPU engines for accurate usage
        try
        {
            // Try multiple GPU counter categories
            string[] categoriesToTry = { "GPU Engine", "GPU Adapter Memory", "GPU Process Engine" };
            
            foreach (var categoryName in categoriesToTry)
            {
                try
                {
                    var category = new System.Diagnostics.PerformanceCounterCategory(categoryName);
                    var instanceNames = category.GetInstanceNames();
                    
                    if (instanceNames.Length > 0)
                    {
                        // Get counters for the first instance to see what's available
                        var firstInstance = instanceNames[0];
                        var availableCounters = category.GetCounters(firstInstance);
                        
                        // Look for utilization counter
                        string? workingCounterName = null;
                        foreach (var counter in availableCounters)
                        {
                            var counterName = counter.CounterName;
                            if (counterName.Contains("Utilization", StringComparison.OrdinalIgnoreCase) ||
                                counterName.Contains("Usage", StringComparison.OrdinalIgnoreCase) ||
                                counterName == "Utilization Percentage")
                            {
                                workingCounterName = counterName;
                                break;
                            }
                        }
                        
                        // If no utilization counter found, try common names
                        if (workingCounterName == null)
                        {
                            string[] commonNames = { "Utilization Percentage", "% Utilization", "Utilization", "Dedicated Usage", "Shared Usage" };
                            foreach (var name in commonNames)
                            {
                                if (availableCounters.Any(c => c.CounterName.Equals(name, StringComparison.OrdinalIgnoreCase)))
                                {
                                    workingCounterName = name;
                                    break;
                                }
                            }
                        }
                        
                        if (workingCounterName != null)
                        {
                            // For GPU Engine category, filter by engine type
                            if (categoryName == "GPU Engine")
                            {
                                var relevantInstances = instanceNames
                                    .Where(name => 
                                        name.Contains("engtype_3D") || 
                                        name.Contains("engtype_Compute") || 
                                        name.Contains("engtype_VideoDecode") || 
                                        name.Contains("engtype_VideoEncode") ||
                                        name.Contains("engtype_Copy"))
                                    .ToList();
                                
                                if (relevantInstances.Count == 0)
                                {
                                    relevantInstances = instanceNames.ToList();
                                }
                                
                                foreach (var instanceName in relevantInstances)
                                {
                                    try
                                    {
                                        var counter = new System.Diagnostics.PerformanceCounter(categoryName, workingCounterName, instanceName);
                                        counter.NextValue(); // First call returns 0
                                        _gpuCounters.Add(counter);
                                        
                                        // Extract process ID from instance name (format: "pid_<pid>_luid_...")
                                        var pid = ExtractPidFromInstanceName(instanceName);
                                        if (pid.HasValue)
                                        {
                                            _gpuCounterToPid[counter] = pid.Value;
                                        }
                                    }
                                    catch { /* Skip */ }
                                }
                            }
                            else
                            {
                                // For other categories, use all instances
                                foreach (var instanceName in instanceNames)
                                {
                                    try
                                    {
                                        var counter = new System.Diagnostics.PerformanceCounter(categoryName, workingCounterName, instanceName);
                                        counter.NextValue(); // First call returns 0
                                        _gpuCounters.Add(counter);
                                        
                                        // Extract process ID from instance name (format: "pid_<pid>_luid_...")
                                        var pid = ExtractPidFromInstanceName(instanceName);
                                        if (pid.HasValue)
                                        {
                                            _gpuCounterToPid[counter] = pid.Value;
                                        }
                                    }
                                    catch { /* Skip */ }
                                }
                            }
                            
                            // If we found counters, break out of category loop
                            if (_gpuCounters.Count > 0)
                            {
                                break;
                            }
                        }
                    }
                }
                catch
                {
                    // Try next category
                    continue;
                }
            }
            
            // If performance counters didn't work, try WMI as fallback
            if (_gpuCounters.Count == 0)
            {
                _useWmiForGpu = TryInitializeGpuWmi();
            }
        }
        catch 
        { 
            // GPU counter not available, try WMI fallback
            _gpuCounters.Clear();
            _useWmiForGpu = TryInitializeGpuWmi();
        }
    }
    
    private int? ExtractPidFromInstanceName(string instanceName)
    {
        // GPU Engine instance names have format: "pid_<pid>_luid_<luid>_phys_<phys>_eng_<eng>_engtype_<type>"
        // Extract PID from the instance name
        try
        {
            var parts = instanceName.Split('_');
            for (int i = 0; i < parts.Length - 1; i++)
            {
                if (parts[i] == "pid" && i + 1 < parts.Length)
                {
                    if (int.TryParse(parts[i + 1], out var pid))
                    {
                        return pid;
                    }
                }
            }
        }
        catch { /* Ignore parsing errors */ }
        return null;
    }

    private bool TryInitializeGpuWmi()
    {
        try
        {
            // Try WMI query for GPU usage (Win32_VideoController or GPU performance data)
            using var searcher = new System.Management.ManagementObjectSearcher(
                "SELECT Name, AdapterRAM FROM Win32_VideoController WHERE Availability=3");
            var results = searcher.Get();
            return results.Count > 0; // If we found GPUs, WMI is available
        }
        catch
        {
            return false;
        }
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    private static readonly IntPtr HwndTopmost = new(-1);
    private const uint SwpNosize = 0x0001;
    private const uint SwpNomove = 0x0002;
    private const uint SwpNoactivate = 0x0010;
    
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    
    private void HideFromAltTab()
    {
        try
        {
            var hWnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
            if (hWnd != IntPtr.Zero)
            {
                int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
                SetWindowLong(hWnd, GWL_EXSTYLE, exStyle | WS_EX_TOOLWINDOW);
            }
        }
        catch { /* Ignored */ }
    }

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
        
        // Try to load from embedded resources first (works with single-file publish)
        if (!LoadIconFromEmbeddedResources())
        {
            // Fallback to file system (for development)
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
        }
        
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
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Show GPU", null, (s, e) => ToggleGpu()) { Checked = _settings.ShowGpu, Name = "gpuItem" });
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Run at Startup", null, (s, e) => ToggleStartup()) { Checked = _settings.RunAtStartup, Name = "startupItem" });
        contextMenu.Items.Add(new WinForms.ToolStripSeparator());
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Check for Updates", null, (s, e) => CheckForUpdates(true)) { Name = "updateItem" });
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Auto-check for Updates", null, (s, e) => ToggleAutoUpdate()) { Checked = _settings.CheckForUpdates, Name = "autoUpdateItem" });
        contextMenu.Items.Add(new WinForms.ToolStripSeparator());
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Exit", null, (s, e) => Close()));
        _notifyIcon.ContextMenuStrip = contextMenu;
    }
    
    private bool LoadIconFromEmbeddedResources()
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            
            // Try different possible resource name patterns
            var possibleNames = new[]
            {
                "WinWebSpeed.logo.ico",
                "logo.ico",
                assembly.GetName().Name + ".logo.ico"
            };
            
            foreach (var resourceName in possibleNames)
            {
                try
                {
                    using var stream = assembly.GetManifestResourceStream(resourceName);
                    if (stream != null)
                    {
                        _notifyIcon!.Icon = new System.Drawing.Icon(stream);
                        return true;
                    }
                }
                catch { /* Try next name */ }
            }
            
            // Fallback: search for any resource ending with logo.ico
            var foundResource = assembly.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith("logo.ico", StringComparison.OrdinalIgnoreCase));
            if (foundResource != null)
            {
                using var stream = assembly.GetManifestResourceStream(foundResource);
                if (stream != null)
                {
                    _notifyIcon!.Icon = new System.Drawing.Icon(stream);
                    return true;
                }
            }
            
            // Try loading PNG from embedded resources
            possibleNames = new[]
            {
                "WinWebSpeed.logo.png",
                "logo.png",
                assembly.GetName().Name + ".logo.png"
            };
            
            foreach (var resourceName in possibleNames)
            {
                try
                {
                    using var stream = assembly.GetManifestResourceStream(resourceName);
                    if (stream != null)
                    {
                        using var bitmap = new System.Drawing.Bitmap(stream);
                        _notifyIcon!.Icon = System.Drawing.Icon.FromHandle(bitmap.GetHicon());
                        return true;
                    }
                }
                catch { /* Try next name */ }
            }
            
            // Fallback: search for any resource ending with logo.png
            foundResource = assembly.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith("logo.png", StringComparison.OrdinalIgnoreCase));
            if (foundResource != null)
            {
                using var stream = assembly.GetManifestResourceStream(foundResource);
                if (stream != null)
                {
                    using var bitmap = new System.Drawing.Bitmap(stream);
                    _notifyIcon!.Icon = System.Drawing.Icon.FromHandle(bitmap.GetHicon());
                    return true;
                }
            }
        }
        catch { /* Ignored */ }
        
        return false;
    }
    
    private void LoadIconFromPng()
    {
        // Try embedded resources first
        if (LoadIconFromEmbeddedResources()) return;
        
        // Fallback to file system (for development)
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
        UpdateGridLayout();
        if (_notifyIcon?.ContextMenuStrip?.Items["cpuItem"] is WinForms.ToolStripMenuItem cpuItem) { cpuItem.Checked = _settings.ShowCpu; }
    }

    private void ToggleRam()
    {
        _settings.ShowRam = !_settings.ShowRam;
        _settings.Save();
        spRam.Visibility = _settings.ShowRam ? Visibility.Visible : Visibility.Collapsed;
        UpdateGridLayout();
        if (_notifyIcon?.ContextMenuStrip?.Items["ramItem"] is WinForms.ToolStripMenuItem ramItem) { ramItem.Checked = _settings.ShowRam; }
    }

    private void ToggleGpu()
    {
        _settings.ShowGpu = !_settings.ShowGpu;
        _settings.Save();
        spGpu.Visibility = _settings.ShowGpu ? Visibility.Visible : Visibility.Collapsed;
        UpdateGridLayout();
        if (_notifyIcon?.ContextMenuStrip?.Items["gpuItem"] is WinForms.ToolStripMenuItem gpuItem) { gpuItem.Checked = _settings.ShowGpu; }
    }

    private void UpdateGridLayout()
    {
        // Download is always at column 0, Upload is always at column 2
        // System stats (CPU, GPU, RAM) are dynamically positioned starting at column 4
        
        int currentColumn = 4; // Start after Upload (which is at column 2)
        
        // CPU comes first
        if (_settings.ShowCpu)
        {
            Grid.SetColumn(spCpu, currentColumn);
            currentColumn += 2; // Column + spacer
        }
        
        // GPU comes after CPU
        if (_settings.ShowGpu)
        {
            Grid.SetColumn(spGpu, currentColumn);
            currentColumn += 2; // Column + spacer
        }
        
        // RAM comes last
        if (_settings.ShowRam)
        {
            Grid.SetColumn(spRam, currentColumn);
        }
        
        UpdateWindowWidth();
    }

    private void UpdateWindowWidth()
    {
        Width = 260 + (_settings.ShowCpu ? 130 : 0) + (_settings.ShowRam ? 130 : 0) + (_settings.ShowGpu ? 130 : 0);
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
        InitializeNetworkBaseline(); // Will also pick primary interface
        UpdateSpeedDisplay(0, 0);

        spCpu.Visibility = _settings.ShowCpu ? Visibility.Visible : Visibility.Collapsed;
        spRam.Visibility = _settings.ShowRam ? Visibility.Visible : Visibility.Collapsed;
        spGpu.Visibility = _settings.ShowGpu ? Visibility.Visible : Visibility.Collapsed;
        UpdateGridLayout();

        // Don't call EnsureWindowOnScreen() here - trust the saved position from user.
        // It will only be called when display settings change via SystemEvents.DisplaySettingsChanged.

        HideFromAltTab();

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

    private void InitializeNetworkBaseline()
    {
        UpdatePrimaryInterface();
        var (rx, tx) = GetNetworkBytes();
        _prevBytesReceived = rx;
        _prevBytesSent = tx;
    }
    
    private void UpdatePrimaryInterface()
    {
        try 
        {
            // Find the active internet interface (has Gateway + Up)
            _primaryInterface = NetworkInterface.GetAllNetworkInterfaces()
                .FirstOrDefault(ni => 
                    ni.OperationalStatus == OperationalStatus.Up && 
                    ni.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                    ni.NetworkInterfaceType != NetworkInterfaceType.Tunnel &&
                    ni.GetIPProperties().GatewayAddresses.Count > 0);
        }
        catch 
        {
            _primaryInterface = null; // Fallback to "all" if this fails (though unlikely)
        }
    }

    private void StatsTimer_Tick(object? sender, EventArgs e)
    {
        try
        {
            var (totalBytesReceived, totalBytesSent) = GetNetworkBytes();

            if (totalBytesReceived == 0 && totalBytesSent == 0)
            {
                txtDownload.Text = "No Network";
                txtUpload.Text = string.Empty;
                UpdateCpuRamDisplay(false);
                return;
            }

            var now = DateTime.Now;

            // Calculate exact time passed since last tick (e.g., 1.05 seconds)
            double timeElapsed = (now - _lastTickTime).TotalSeconds;
            
            // Prevent division by zero or extremely small intervals on startup
            if (timeElapsed > 0)
            {
                // Calculate raw difference
                long bytesReceivedDiff = totalBytesReceived - _prevBytesReceived;
                long bytesSentDiff = totalBytesSent - _prevBytesSent;

                // Adjust purely for the time elapsed. 
                // If 100Mb came in 1.2 seconds, this results in 83Mb/s (Correct) 
                // instead of 100Mb/s (Incorrect).
                _currentDownloadSpeed = (long)(bytesReceivedDiff / timeElapsed);
                _currentUploadSpeed = (long)(bytesSentDiff / timeElapsed);
            }

            // Handle negative values (counter reset)
            if (_currentDownloadSpeed < 0) _currentDownloadSpeed = 0;
            if (_currentUploadSpeed < 0) _currentUploadSpeed = 0;

            _prevBytesReceived = totalBytesReceived;
            _prevBytesSent = totalBytesSent;
            _lastTickTime = now; // Reset time for next tick

            UpdateSpeedDisplay(_currentDownloadSpeed, _currentUploadSpeed);
            
            // Optimization: Always update global CPU%, but only scan processes every N seconds
            _processUpdateTickCounter++;
            bool updateProcesses = _processUpdateTickCounter >= ProcessUpdateIntervalTicks;
            if (updateProcesses) _processUpdateTickCounter = 0;
            
            UpdateCpuRamDisplay(updateProcesses);
        }
        catch
        {
            txtDownload.Text = "No Network";
            txtUpload.Text = string.Empty;
            UpdateCpuRamDisplay(false);
        }
    }

    private (long totalReceived, long totalSent) GetNetworkBytes()
    {
        if (_primaryInterface != null)
        {
            try
            {
                var stats = _primaryInterface.GetIPStatistics();
                return (stats.BytesReceived, stats.BytesSent);
            }
            catch
            {
                // Interface might have gone down; trigger refresh logic next time or now?
                // For now, return 0 or fall through. A refresh will happen via event usually.
            }
        }

        // Fallback: Aggregate all if no primary detected or primary failed
        return GetAggregatedNetworkBytes();
    }

    private static (long totalReceived, long totalSent) GetAggregatedNetworkBytes()
    {
        long totalReceived = 0;
        long totalSent = 0;

        try
        {
            var interfaces = NetworkInterface.GetAllNetworkInterfaces()
                .Where(ni => ni.OperationalStatus == OperationalStatus.Up &&
                             ni.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                             ni.NetworkInterfaceType != NetworkInterfaceType.Tunnel);

            foreach (var networkInterface in interfaces)
            {
                try
                {
                    var stats = networkInterface.GetIPStatistics();
                    totalReceived += stats.BytesReceived;
                    totalSent += stats.BytesSent;
                }
                catch { /* Ignore */ }
            }
        }
        catch { /* Ignore */ }

        return (totalReceived, totalSent);
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

    private void UpdateCpuRamDisplay(bool updateTopProcesses)
    {
        if (_settings.ShowCpu && _cpuCounter != null)
        {
            try
            {
                var cpuUsage = _cpuCounter.NextValue();
                txtCpu.Text = $"{cpuUsage:F1}%";
            }
            catch { /* ignored */ }
        }

        if (_settings.ShowRam)
        {
            try
            {
                var memStatus = new MemoryStatusEx();
                memStatus.Init();
                if (GlobalMemoryStatusEx(ref memStatus))
                {
                    txtRam.Text = $"{memStatus.dwMemoryLoad}%";
                }
            }
            catch { /* ignored */ }
        }

        if (_settings.ShowGpu)
        {
            if (_gpuCounters.Count > 0)
            {
                try
                {
                    // Get GPU usage from all engine instances and track per-process
                    // Use maximum utilization across all engines (engines can run in parallel)
                    double maxGpuUsage = 0;
                    double sumGpuUsage = 0;
                    int validReadings = 0;
                    
                    // Clear previous GPU usage tracking
                    _gpuUsageByPid.Clear();
                    
                    foreach (var counter in _gpuCounters)
                    {
                        try
                        {
                            // Read the counter - performance counters often return 0 on first read
                            // The actual value comes on subsequent reads
                            var usage = counter.NextValue();
                            
                            // Validate the reading
                            if (usage >= 0 && usage <= 100)
                            {
                                maxGpuUsage = Math.Max(maxGpuUsage, usage);
                                sumGpuUsage += usage;
                                validReadings++;
                                
                                // Track usage per process if we have PID mapping
                                if (_gpuCounterToPid.TryGetValue(counter, out var pid))
                                {
                                    if (!_gpuUsageByPid.ContainsKey(pid))
                                    {
                                        _gpuUsageByPid[pid] = 0;
                                    }
                                    _gpuUsageByPid[pid] = Math.Max(_gpuUsageByPid[pid], usage);
                                }
                            }
                            // If usage is 0, it might be valid (GPU idle) or first read
                            // We'll accept it but track separately
                            else if (usage == 0)
                            {
                                validReadings++; // Count as valid but idle
                            }
                        }
                        catch { /* Skip failed counter */ }
                    }
                    
                    if (validReadings > 0)
                    {
                        // Use maximum as it represents peak GPU load
                        // But if we have many engines, also consider average
                        double finalUsage = maxGpuUsage;
                        
                        // If we have multiple readings and max is very low but sum is high,
                        // it might indicate the counter format is different
                        if (validReadings > 1 && maxGpuUsage < 5 && sumGpuUsage > 10)
                        {
                            // Try average as fallback
                            finalUsage = Math.Min(sumGpuUsage / validReadings, 100);
                        }
                        
                        txtGpu.Text = $"{finalUsage:F1}%";
                    }
                    else
                    {
                        txtGpu.Text = "0%";
                    }
                }
                catch { /* ignored */ }
            }
            else if (_useWmiForGpu)
            {
                // Fallback to WMI method
                try
                {
                    var gpuUsage = GetGpuUsageWmi();
                    if (gpuUsage.HasValue)
                    {
                        txtGpu.Text = $"{gpuUsage.Value:F1}%";
                    }
                    else
                    {
                        txtGpu.Text = "0%";
                    }
                }
                catch
                {
                    txtGpu.Text = "0%";
                }
            }
            else
            {
                txtGpu.Text = "0%";
            }
        }

        if (updateTopProcesses)
        {
            // Optimization: Only scan for top processes if CPU or RAM view is enabled
            if (_settings.ShowCpu || _settings.ShowRam)
            {
                var (topCpu, topRam) = GetTopProcesses();
                if (_settings.ShowCpu) txtTopCpu.Text = topCpu ?? "-";
                if (_settings.ShowRam) txtTopRam.Text = topRam ?? "-";
            }
            
            // Get top GPU process only if GPU view is enabled
            if (_settings.ShowGpu)
            {
                var topGpu = GetTopGpuProcess();
                txtTopGpu.Text = topGpu ?? "-";
            }
        }
    }
    
    private string? GetTopGpuProcess()
    {
        if (_gpuUsageByPid.Count == 0) return null;
        
        try
        {
            // Find the process ID with highest GPU usage
            var topPid = _gpuUsageByPid.OrderByDescending(kvp => kvp.Value).First().Key;
            
            // Get the process name
            try
            {
                var process = System.Diagnostics.Process.GetProcessById(topPid);
                return process.ProcessName;
            }
            catch
            {
                // Process might have exited, return null
                return null;
            }
        }
        catch
        {
            return null;
        }
    }

    private double? GetGpuUsageWmi()
    {
        // WMI fallback for GPU usage - not currently implemented
        return null;
    }

    private (string? topCpu, string? topRam) GetTopProcesses()
    {
        try
        {
            var elapsed = (DateTime.Now - _prevTime).TotalMilliseconds;
            _prevTime = DateTime.Now; // Update time for next check

            if (elapsed < 500) return (null, null);

            string? topCpuName = null;
            double maxCpu = -1;
            
            string? topRamName = null;
            long maxRam = -1;

            var processes = System.Diagnostics.Process.GetProcesses();
            var currentPids = new HashSet<int>();

            foreach (var process in processes)
            {
                using (process) // CRITICAL: Dispose process handles to free memory
                {
                    try
                    {
                        var pid = process.Id;
                        currentPids.Add(pid);
                        
                        // RAM Check (Working Set)
                        long workingSet = process.WorkingSet64;
                        if (workingSet > maxRam)
                        {
                            maxRam = workingSet;
                            topRamName = process.ProcessName;
                        }

                        // CPU Check
                        var currentProcessorTime = process.TotalProcessorTime;
                        if (_prevProcessorTimes.TryGetValue(pid, out var prevProcessorTime))
                        {
                            var cpuUsedMs = (currentProcessorTime - prevProcessorTime).TotalMilliseconds;
                            var cpuPercent = cpuUsedMs / (elapsed * Environment.ProcessorCount) * 100;
                            if (cpuPercent > maxCpu)
                            {
                                maxCpu = cpuPercent;
                                topCpuName = process.ProcessName;
                            }
                        }
                        _prevProcessorTimes[pid] = currentProcessorTime;
                    }
                    catch { /* Access denied or process exited */ }
                }
            }

            // Memory Optimization: Clean up history for closed processes
            // We can't modify the dictionary while iterating, so find keys first
            var deadPids = _prevProcessorTimes.Keys.Where(k => !currentPids.Contains(k)).ToList();
            foreach (var pid in deadPids) _prevProcessorTimes.Remove(pid);

            return (topCpuName, topRamName);
        }
        catch { return (null, null); }
    }

    private void ApplyTheme(Theme theme)
    {
        var textColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.TextColor)!;
        var barColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.BarColor)!;

        txtDownload.Foreground = textColor;
        txtUpload.Foreground = textColor;
        txtCpu.Foreground = textColor;
        txtRam.Foreground = textColor;
        txtGpu.Foreground = textColor;
        pbDownload.Foreground = barColor;
        pbUpload.Foreground = barColor;
    }

    private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState == MouseButtonState.Pressed)
        {
            try
            {
                DragMove();
            }
            finally
            {
                PersistWindowPosition();
            }
        }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        // Ensure current position is saved before closing
        PersistWindowPosition();

        _settings.Save();
        _notifyIcon?.Dispose();
        _cpuCounter?.Dispose();
        foreach (var counter in _gpuCounters)
        {
            counter?.Dispose();
        }
        _gpuCounters.Clear();
        _statsTimer.Stop();
        _topmostTimer.Stop();
        NetworkChange.NetworkAddressChanged -= NetworkChange_NetworkAddressChanged;
        SystemEvents.DisplaySettingsChanged -= SystemEvents_DisplaySettingsChanged;
        base.OnClosing(e);
    }

    private void PersistWindowPosition()
    {
        _settings.WindowX = Left;
        _settings.WindowY = Top;
        _settings.Save();
    }
}

