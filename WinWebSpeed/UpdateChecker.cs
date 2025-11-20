using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace WinWebSpeed;

public class UpdateInfo
{
    public string Version { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string ReleaseNotes { get; set; } = "";
    public bool IsNewer { get; set; }
}

public static class UpdateChecker
{
    private const string GitHubApiUrl = "https://api.github.com/repos/seppelz/winwebspeed/releases/latest";
    private static readonly HttpClient HttpClient = new HttpClient();
    
    static UpdateChecker()
    {
        HttpClient.DefaultRequestHeaders.Add("User-Agent", "WinWebSpeed/1.0");
    }

    public static async Task<UpdateInfo?> CheckForUpdatesAsync(string currentVersion)
    {
        try
        {
            var response = await HttpClient.GetStringAsync(GitHubApiUrl);
            var release = JsonSerializer.Deserialize<JsonElement>(response);
            
            var latestVersion = release.GetProperty("tag_name").GetString()?.TrimStart('v') ?? "";
            var downloadUrl = "";
            var releaseNotes = release.GetProperty("body").GetString() ?? "";

            // Find the WinWebSpeed.exe asset
            if (release.TryGetProperty("assets", out var assets))
            {
                foreach (var asset in assets.EnumerateArray())
                {
                    var name = asset.GetProperty("name").GetString();
                    if (name == "WinWebSpeed.exe")
                    {
                        downloadUrl = asset.GetProperty("browser_download_url").GetString() ?? "";
                        break;
                    }
                }
            }

            // If no asset found, use the release page
            if (string.IsNullOrEmpty(downloadUrl))
            {
                var htmlUrl = release.GetProperty("html_url").GetString() ?? "";
                downloadUrl = htmlUrl;
            }

            var isNewer = CompareVersions(latestVersion, currentVersion) > 0;

            return new UpdateInfo
            {
                Version = latestVersion,
                DownloadUrl = downloadUrl,
                ReleaseNotes = releaseNotes,
                IsNewer = isNewer
            };
        }
        catch
        {
            return null;
        }
    }

    private static int CompareVersions(string version1, string version2)
    {
        try
        {
            var v1Parts = version1.Split('.');
            var v2Parts = version2.Split('.');

            for (int i = 0; i < Math.Max(v1Parts.Length, v2Parts.Length); i++)
            {
                var v1Part = i < v1Parts.Length && int.TryParse(v1Parts[i], out var v1) ? v1 : 0;
                var v2Part = i < v2Parts.Length && int.TryParse(v2Parts[i], out var v2) ? v2 : 0;

                if (v1Part > v2Part) return 1;
                if (v1Part < v2Part) return -1;
            }

            return 0;
        }
        catch
        {
            return 0; // If comparison fails, assume versions are equal
        }
    }
}

