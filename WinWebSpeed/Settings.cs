using Microsoft.Win32;

namespace WinWebSpeed;

public enum SpeedUnit
{
    Bytes,
    Bits
}

public class Theme
{
    public string Name { get; set; } = "Orange";
    public string TextColor { get; set; } = "#FFFFFF";
    public string BarColor { get; set; } = "#FFD700";
    public string LabelColor { get; set; } = "#CCCCCC";

    public static Theme[] PredefinedThemes = new Theme[]
    {
        new Theme { Name = "Orange", TextColor = "#FFFFFF", BarColor = "#FFD700", LabelColor = "#CCCCCC" },
        new Theme { Name = "Blue", TextColor = "#FFFFFF", BarColor = "#4A9EFF", LabelColor = "#CCCCCC" },
        new Theme { Name = "Green", TextColor = "#FFFFFF", BarColor = "#4AFF88", LabelColor = "#CCCCCC" },
        new Theme { Name = "Purple", TextColor = "#FFFFFF", BarColor = "#B84AFF", LabelColor = "#CCCCCC" },
        new Theme { Name = "Red", TextColor = "#FFFFFF", BarColor = "#FF4A4A", LabelColor = "#CCCCCC" },
        new Theme { Name = "Cyan", TextColor = "#FFFFFF", BarColor = "#4AFFFF", LabelColor = "#CCCCCC" }
    };

    public static Theme GetTheme(string name)
    {
        return Array.Find(PredefinedThemes, t => t.Name == name) ?? PredefinedThemes[0];
    }
}

public class Settings
{
    public double WindowX { get; set; } = double.NaN;
    public double WindowY { get; set; } = double.NaN;
    public SpeedUnit SpeedUnit { get; set; } = SpeedUnit.Bytes;
    public bool ShowCpu { get; set; } = true;
    public bool ShowRam { get; set; } = true;
    public bool RunAtStartup { get; set; } = false;
    public int MaxSpeed { get; set; } = 100;
    public string ThemeName { get; set; } = "Orange";
    public string? CustomTextColor { get; set; }
    public string? CustomBarColor { get; set; }
    public string? CustomLabelColor { get; set; }
    public DateTime LastUpdateCheck { get; set; } = DateTime.MinValue;

    private const string RegistryKeyPath = @"Software\WinWebSpeed";

    public void Save()
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RegistryKeyPath);
            if (key != null)
            {
                key.SetValue("WindowX", WindowX);
                key.SetValue("WindowY", WindowY);
                key.SetValue("SpeedUnit", SpeedUnit.ToString());
                key.SetValue("ShowCpu", ShowCpu ? 1 : 0);
                key.SetValue("ShowRam", ShowRam ? 1 : 0);
                key.SetValue("RunAtStartup", RunAtStartup ? 1 : 0);
                key.SetValue("MaxSpeed", MaxSpeed);
                key.SetValue("ThemeName", ThemeName);
                if (CustomTextColor != null) key.SetValue("CustomTextColor", CustomTextColor);
                if (CustomBarColor != null) key.SetValue("CustomBarColor", CustomBarColor);
                if (CustomLabelColor != null) key.SetValue("CustomLabelColor", CustomLabelColor);
                key.SetValue("LastUpdateCheck", LastUpdateCheck.ToBinary());
            }
        }
        catch { /* Ignore registry errors */ }
    }

    public static Settings Load()
    {
        var settings = new Settings();
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKeyPath);
            if (key != null)
            {
                settings.WindowX = Convert.ToDouble(key.GetValue("WindowX", double.NaN));
                settings.WindowY = Convert.ToDouble(key.GetValue("WindowY", double.NaN));
                var unitStr = key.GetValue("SpeedUnit", "Bytes")?.ToString();
                settings.SpeedUnit = Enum.TryParse<SpeedUnit>(unitStr, out var unit) ? unit : SpeedUnit.Bytes;
                settings.ShowCpu = Convert.ToInt32(key.GetValue("ShowCpu", 1)) == 1;
                settings.ShowRam = Convert.ToInt32(key.GetValue("ShowRam", 1)) == 1;
                settings.RunAtStartup = Convert.ToInt32(key.GetValue("RunAtStartup", 0)) == 1;
                settings.MaxSpeed = Convert.ToInt32(key.GetValue("MaxSpeed", 100));
                settings.ThemeName = key.GetValue("ThemeName", "Orange")?.ToString() ?? "Orange";
                settings.CustomTextColor = key.GetValue("CustomTextColor")?.ToString();
                settings.CustomBarColor = key.GetValue("CustomBarColor")?.ToString();
                settings.CustomLabelColor = key.GetValue("CustomLabelColor")?.ToString();
                var checkBinary = key.GetValue("LastUpdateCheck");
                if (checkBinary != null)
                {
                    settings.LastUpdateCheck = DateTime.FromBinary(Convert.ToInt64(checkBinary));
                }
            }
        }
        catch { /* Ignore registry errors */ }
        return settings;
    }
}
