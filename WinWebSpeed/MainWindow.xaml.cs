using System.ComponentModel;
using System.Net.NetworkInformation;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Media;
using Microsoft.Win32;
using WinForms = System.Windows.Forms;

namespace WinWebSpeed;

public partial class MainWindow : Window
{
    private DispatcherTimer _timer;
    private NetworkInterface? _activeInterface;
    private long _prevBytesReceived;
    private long _prevBytesSent;
    private const int UpdateInterval = 1000; // 1 second
    
    // Store current speeds for immediate UI refresh
    private long _currentDownloadSpeed;
    private long _currentUploadSpeed;

    private WinForms.NotifyIcon? _notifyIcon;
    private Settings _settings;
    private Theme _currentTheme;
    private int _maxSpeed = 100;
    private const string RegistryKeyName = "WinWebSpeed";

    // CPU & RAM Counters
    private System.Diagnostics.PerformanceCounter? _cpuCounter;
    private Dictionary<int, TimeSpan> _prevProcessorTimes = new Dictionary<int, TimeSpan>();
    private DateTime _prevTime = DateTime.Now;

    public MainWindow()
    {
        InitializeComponent();
        
        // Load settings
        _settings = Settings.Load();
        _currentTheme = Theme.GetTheme(_settings.ThemeName);
        _maxSpeed = _settings.MaxSpeed;
        
        _timer = new DispatcherTimer();
        InitializeTrayIcon();
        InitializePerformanceCounters();
        Loaded += MainWindow_Loaded;
        LocationChanged += MainWindow_LocationChanged;
        
        // Ensure topmost behavior
        Deactivated += (s, e) => { ForceTopMost(); };
        
        // Apply saved position
        if (!double.IsNaN(_settings.WindowX) && !double.IsNaN(_settings.WindowY))
        {
            Left = _settings.WindowX;
            Top = _settings.WindowY;
        }
        else
        {
            // Default position: bottom-right corner
            var workingArea = SystemParameters.WorkArea;
            Left = workingArea.Right - Width - 10;
            Top = workingArea.Bottom - Height - 10;
        }
        
        // Apply theme
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
    static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOACTIVATE = 0x0010;

    private void ForceTopMost()
    {
        IntPtr hWnd = new System.Windows.Interop.WindowInteropHelper(this).Handle;
        SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
    }

    // RAM P/Invoke
    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
    static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
    public struct MEMORYSTATUSEX
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
        public void Init()
        {
            dwLength = (uint)System.Runtime.InteropServices.Marshal.SizeOf(typeof(MEMORYSTATUSEX));
        }
    }

    private void InitializeTrayIcon()
    {
        _notifyIcon = new WinForms.NotifyIcon();
        
        string iconPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logo.png");
        if (System.IO.File.Exists(iconPath))
        {
            try 
            {
                using var bitmap = new System.Drawing.Bitmap(iconPath);
                _notifyIcon.Icon = System.Drawing.Icon.FromHandle(bitmap.GetHicon());
            }
            catch
            {
                _notifyIcon.Icon = System.Drawing.SystemIcons.Application;
            }
        }
        else
        {
            _notifyIcon.Icon = System.Drawing.SystemIcons.Application;
        }

        _notifyIcon.Visible = true;
        _notifyIcon.Text = "WinWebSpeed";

        var contextMenu = new WinForms.ContextMenuStrip();

        // Unit Selection
        var unitItem = new WinForms.ToolStripMenuItem("Speed Unit");
        var bytesItem = new WinForms.ToolStripMenuItem("Bytes/s (KB/s, MB/s)", null, (s, e) => SetUnit(SpeedUnit.Bytes));
        var bitsItem = new WinForms.ToolStripMenuItem("Bits/s (Kbit/s, Mbit/s)", null, (s, e) => SetUnit(SpeedUnit.Bits));
        bytesItem.Checked = _settings.SpeedUnit == SpeedUnit.Bytes;
        bitsItem.Checked = _settings.SpeedUnit == SpeedUnit.Bits;
        unitItem.DropDownItems.Add(bytesItem);
        unitItem.DropDownItems.Add(bitsItem);
        contextMenu.Items.Add(unitItem);

        // Max Speed Selection
        var maxSpeedItem = new WinForms.ToolStripMenuItem("Max Speed");
        int[] speeds = { 10, 25, 50, 100, 250, 500, 1000 };
        foreach (var speed in speeds)
        {
            var speedItem = new WinForms.ToolStripMenuItem($"{speed} Mbit/s", null, (s, e) => SetMaxSpeed(speed));
            speedItem.Checked = _maxSpeed == speed;
            maxSpeedItem.DropDownItems.Add(speedItem);
        }
        contextMenu.Items.Add(maxSpeedItem);

        // Themes
        var themeItem = new WinForms.ToolStripMenuItem("Themes");
        foreach (var theme in Theme.PredefinedThemes)
        {
            var themeMenuItem = new WinForms.ToolStripMenuItem(theme.Name, null, (s, e) => SetTheme(theme.Name));
            themeMenuItem.Checked = _settings.ThemeName == theme.Name;
            themeItem.DropDownItems.Add(themeMenuItem);
        }
        contextMenu.Items.Add(themeItem);

        contextMenu.Items.Add(new WinForms.ToolStripSeparator());

        // Toggles
        var cpuItem = new WinForms.ToolStripMenuItem("Show CPU", null, (s, e) => ToggleCpu());
        cpuItem.Checked = _settings.ShowCpu;
        cpuItem.Name = "cpuItem";
        contextMenu.Items.Add(cpuItem);

        var ramItem = new WinForms.ToolStripMenuItem("Show RAM", null, (s, e) => ToggleRam());
        ramItem.Checked = _settings.ShowRam;
        ramItem.Name = "ramItem";
        contextMenu.Items.Add(ramItem);

        // Run at Startup
        var startupItem = new WinForms.ToolStripMenuItem("Run at Startup", null, (s, e) => ToggleStartup());
        startupItem.Checked = _settings.RunAtStartup;
        startupItem.Name = "startupItem";
        contextMenu.Items.Add(startupItem);

        contextMenu.Items.Add(new WinForms.ToolStripSeparator());

        // Exit
        contextMenu.Items.Add(new WinForms.ToolStripMenuItem("Exit", null, (s, e) => Close()));

        _notifyIcon.ContextMenuStrip = contextMenu;
    }

    private void SetTheme(string themeName)
    {
        _currentTheme = Theme.GetTheme(themeName);
        _settings.ThemeName = themeName;
        _settings.Save();
        ApplyTheme(_currentTheme);
        
        // Update checkmarks
        if (_notifyIcon?.ContextMenuStrip != null)
        {
            var themeMenu = _notifyIcon.ContextMenuStrip.Items.OfType<WinForms.ToolStripMenuItem>()
                .FirstOrDefault(x => x.Text == "Themes");
            if (themeMenu != null)
            {
                foreach (WinForms.ToolStripMenuItem item in themeMenu.DropDownItems)
                {
                    item.Checked = item.Text == themeName;
                }
            }
        }
    }

    private void SetMaxSpeed(int speed)
    {
        _maxSpeed = speed;
        _settings.MaxSpeed = speed;
        _settings.Save();
        
        // Update checkmarks
        if (_notifyIcon?.ContextMenuStrip != null)
        {
            var maxSpeedMenu = _notifyIcon.ContextMenuStrip.Items.OfType<WinForms.ToolStripMenuItem>()
                .FirstOrDefault(x => x.Text == "Max Speed");
            if (maxSpeedMenu != null)
            {
                foreach (WinForms.ToolStripMenuItem item in maxSpeedMenu.DropDownItems)
                {
                    item.Checked = item.Text == $"{speed} Mbit/s";
                }
            }
        }
    }

    private void ToggleCpu()
    {
        _settings.ShowCpu = !_settings.ShowCpu;
        _settings.Save();
        spCpu.Visibility = _settings.ShowCpu ? Visibility.Visible : Visibility.Collapsed;
        UpdateWindowWidth();
        
        if (_notifyIcon?.ContextMenuStrip != null)
        {
            var cpuItem = _notifyIcon.ContextMenuStrip.Items["cpuItem"] as WinForms.ToolStripMenuItem;
            if (cpuItem != null)
            {
                cpuItem.Checked = _settings.ShowCpu;
            }
        }
    }

    private void ToggleRam()
    {
        _settings.ShowRam = !_settings.ShowRam;
        _settings.Save();
        spRam.Visibility = _settings.ShowRam ? Visibility.Visible : Visibility.Collapsed;
        UpdateWindowWidth();

        if (_notifyIcon?.ContextMenuStrip != null)
        {
            var ramItem = _notifyIcon.ContextMenuStrip.Items["ramItem"] as WinForms.ToolStripMenuItem;
            if (ramItem != null)
            {
                ramItem.Checked = _settings.ShowRam;
            }
        }
    }

    private void UpdateWindowWidth()
    {
        double width = 260; // Base width for DL/UL
        if (_settings.ShowCpu) width += 130;
        if (_settings.ShowRam) width += 130;
        this.Width = width;
    }

    private void SetUnit(SpeedUnit unit)
    {
        _settings.SpeedUnit = unit;
        _settings.Save();
        UpdateSpeedDisplay(_currentDownloadSpeed, _currentUploadSpeed);
        
        // Update checkmarks
        if (_notifyIcon?.ContextMenuStrip != null)
        {
            var unitMenu = _notifyIcon.ContextMenuStrip.Items.OfType<WinForms.ToolStripMenuItem>()
                .FirstOrDefault(x => x.Text == "Speed Unit");
            if (unitMenu != null)
            {
                foreach (WinForms.ToolStripMenuItem item in unitMenu.DropDownItems)
                {
                    if (item.Text != null)
                    {
                        item.Checked = (item.Text.Contains("Bytes") && unit == SpeedUnit.Bytes) ||
                                      (item.Text.Contains("Bits") && unit == SpeedUnit.Bits);
                    }
                }
            }
        }
    }

    private void ToggleStartup()
    {
        _settings.RunAtStartup = !_settings.RunAtStartup;
        _settings.Save();
        
        using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true);
        if (key == null) return;

        if (_settings.RunAtStartup)
        {
            string exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName ?? "";
            key.SetValue(RegistryKeyName, exePath);
        }
        else
        {
            key.DeleteValue(RegistryKeyName, false);
        }
        
        if (_notifyIcon?.ContextMenuStrip != null)
        {
            var startupItem = _notifyIcon.ContextMenuStrip.Items["startupItem"] as WinForms.ToolStripMenuItem;
            if (startupItem != null)
            {
                startupItem.Checked = _settings.RunAtStartup;
            }
        }
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        // Find active network interface
        FindActiveInterface();

        // Start monitoring
        _timer.Interval = TimeSpan.FromMilliseconds(UpdateInterval);
        _timer.Tick += Timer_Tick;
        _timer.Start();
        
        // Apply saved visibility
        spCpu.Visibility = _settings.ShowCpu ? Visibility.Visible : Visibility.Collapsed;
        spRam.Visibility = _settings.ShowRam ? Visibility.Visible : Visibility.Collapsed;
        UpdateWindowWidth();
    }

    private void FindActiveInterface()
    {
        var interfaces = NetworkInterface.GetAllNetworkInterfaces()
            .Where(ni => ni.OperationalStatus == OperationalStatus.Up &&
                        ni.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .OrderByDescending(ni => ni.Speed);

        _activeInterface = interfaces.FirstOrDefault();

        if (_activeInterface != null)
        {
            var stats = _activeInterface.GetIPv4Statistics();
            _prevBytesReceived = stats.BytesReceived;
            _prevBytesSent = stats.BytesSent;
        }
    }

    private void Timer_Tick(object? sender, EventArgs e)
    {
        if (_activeInterface == null)
        {
            FindActiveInterface();
            return;
        }

        try
        {
            var stats = _activeInterface.GetIPv4Statistics();
            long currentBytesReceived = stats.BytesReceived;
            long currentBytesSent = stats.BytesSent;

            _currentDownloadSpeed = currentBytesReceived - _prevBytesReceived;
            _currentUploadSpeed = currentBytesSent - _prevBytesSent;

            _prevBytesReceived = currentBytesReceived;
            _prevBytesSent = currentBytesSent;

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
        double downloadValue, uploadValue;
        string dlUnit, ulUnit;

        if (_settings.SpeedUnit == SpeedUnit.Bits)
        {
            downloadValue = (downloadBytes * 8) / 1_000_000.0;
            uploadValue = (uploadBytes * 8) / 1_000_000.0;
            dlUnit = "Mbit/s";
            ulUnit = "Mbit/s";
        }
        else
        {
            downloadValue = downloadBytes / 1_000_000.0;
            uploadValue = uploadBytes / 1_000_000.0;
            
            if (downloadValue < 1)
            {
                downloadValue = downloadBytes / 1_000.0;
                dlUnit = "KB/s";
            }
            else
            {
                dlUnit = "MB/s";
            }
            
            if (uploadValue < 1)
            {
                uploadValue = uploadBytes / 1_000.0;
                ulUnit = "KB/s";
            }
            else
            {
                ulUnit = "MB/s";
            }
        }

        txtDownload.Text = $"{downloadValue:F1} {dlUnit}";
        txtUpload.Text = $"{uploadValue:F1} {ulUnit}";

        // Update progress bars based on max speed
        // Convert maxSpeed to match current unit
        double maxSpeedForCalc = _maxSpeed;
        if (_settings.SpeedUnit == SpeedUnit.Bits)
        {
            maxSpeedForCalc *= 8; // Convert to bits
        }
        
        double dlPercent = (downloadValue / maxSpeedForCalc) * 100;
        double ulPercent = (uploadValue / maxSpeedForCalc) * 100;
        pbDownload.Value = Math.Min(dlPercent, 100);
        pbUpload.Value = Math.Min(ulPercent, 100);
    }

    private void UpdateCpuRamDisplay()
    {
        // CPU
        if (_cpuCounter != null)
        {
            try
            {
                float cpuUsage = _cpuCounter.NextValue();
                txtCpu.Text = $"{cpuUsage:F1}%";

                var topCpuProcess = GetTopCpuProcess();
                txtTopCpu.Text = topCpuProcess ?? "-";
            }
            catch { }
        }

        // RAM
        try
        {
            MEMORYSTATUSEX memStatus = new MEMORYSTATUSEX();
            memStatus.Init();
            if (GlobalMemoryStatusEx(ref memStatus))
            {
                txtRam.Text = $"{memStatus.dwMemoryLoad}%";

                var topRamProcess = GetTopRamProcess();
                txtTopRam.Text = topRamProcess ?? "-";
            }
        }
        catch { }
    }

    private string? GetTopCpuProcess()
    {
        try
        {
            var processes = System.Diagnostics.Process.GetProcesses();
            var currentTime = DateTime.Now;
            var elapsed = (currentTime - _prevTime).TotalMilliseconds;

            string? topProcess = null;
            double maxCpu = 0;

            foreach (var process in processes)
            {
                try
                {
                    int pid = process.Id;
                    TimeSpan currentProcessorTime = process.TotalProcessorTime;

                    if (_prevProcessorTimes.ContainsKey(pid))
                    {
                        TimeSpan prevProcessorTime = _prevProcessorTimes[pid];
                        double cpuUsed = (currentProcessorTime - prevProcessorTime).TotalMilliseconds;
                        double cpuPercent = (cpuUsed / (elapsed * Environment.ProcessorCount)) * 100;

                        if (cpuPercent > maxCpu)
                        {
                            maxCpu = cpuPercent;
                            topProcess = process.ProcessName;
                        }
                    }

                    _prevProcessorTimes[pid] = currentProcessorTime;
                }
                catch { }
            }

            _prevTime = currentTime;
            return topProcess;
        }
        catch
        {
            return null;
        }
    }

    private string? GetTopRamProcess()
    {
        try
        {
            var topProcess = System.Diagnostics.Process.GetProcesses()
                .OrderByDescending(p =>
                {
                    try { return p.WorkingSet64; }
                    catch { return 0; }
                })
                .FirstOrDefault();

            return topProcess?.ProcessName;
        }
        catch
        {
            return null;
        }
    }

    private void ApplyTheme(Theme theme)
    {
        if (_settings.CustomTextColor != null || _settings.CustomBarColor != null || _settings.CustomLabelColor != null)
        {
            theme.TextColor = _settings.CustomTextColor ?? theme.TextColor;
            theme.BarColor = _settings.CustomBarColor ?? theme.BarColor;
            theme.LabelColor = _settings.CustomLabelColor ?? theme.LabelColor;
        }

        var textColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.TextColor)!;
        var barColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.BarColor)!;
        var labelColor = (SolidColorBrush)new BrushConverter().ConvertFrom(theme.LabelColor)!;

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
        _timer?.Stop();
        base.OnClosing(e);
    }
}
