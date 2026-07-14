using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CS2Haze.Launcher.Models;

namespace CS2Haze.Launcher.Services;

public sealed class StorageService
{
    public string DataDirectory { get; }
    public string LogsDirectory { get; }
    private string StatePath => Path.Combine(DataDirectory, "state.json");

    public StorageService()
    {
        DataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "cs2haze"
        );
        LogsDirectory = Path.Combine(DataDirectory, "logs");
        Directory.CreateDirectory(DataDirectory);
        Directory.CreateDirectory(LogsDirectory);
    }

    public LocalState LoadState()
    {
        try
        {
            if (!File.Exists(StatePath)) return new LocalState();
            return JsonSerializer.Deserialize<LocalState>(File.ReadAllText(StatePath))
                ?? new LocalState();
        }
        catch
        {
            return new LocalState();
        }
    }

    public void SaveState(LocalState state)
    {
        var json = JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(StatePath, json);
    }

    public string Protect(string value)
    {
        var input = Encoding.UTF8.GetBytes(value);
        var output = ProtectedData.Protect(input, null, DataProtectionScope.CurrentUser);
        return Convert.ToBase64String(output);
    }

    public string? Unprotect(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            var input = Convert.FromBase64String(value);
            var output = ProtectedData.Unprotect(input, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(output);
        }
        catch
        {
            return null;
        }
    }
}
