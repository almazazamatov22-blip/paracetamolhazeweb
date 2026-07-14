using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using CS2Haze.Launcher.Models;

namespace CS2Haze.Launcher.Services;

public sealed class AuthService(HttpClient http, LauncherConfig config, StorageService storage)
{
    public async Task<LauncherSession?> TryRestoreSessionAsync(
        LocalState state,
        CancellationToken cancellationToken
    )
    {
        var refreshToken = storage.Unprotect(state.ProtectedRefreshToken);
        if (string.IsNullOrWhiteSpace(refreshToken)) return null;

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{config.ApiBaseUrl}/api/cs2/launcher/auth/refresh"
        );
        request.Content = JsonContent.Create(new { refreshToken });
        using var response = await http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<LauncherSession>(
            cancellationToken: cancellationToken
        );
    }

    public async Task<LauncherSession> LoginThroughExistingWebsiteAsync(
        Action<string> setStatus,
        CancellationToken cancellationToken
    )
    {
        var tokenPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "cs2haze", "pending-connect-token.txt");
        var startTime = DateTime.UtcNow;

        if (File.Exists(tokenPath))
        {
            try
            {
                var fileInfo = new FileInfo(tokenPath);
                if (fileInfo.CreationTimeUtc < startTime)
                {
                    File.Delete(tokenPath);
                }
            }
            catch { }
        }

        var connectUrl = "https://paracetamolhaze.ru/cs2haze/connect";
        Process.Start(new ProcessStartInfo
        {
            FileName = connectUrl,
            UseShellExecute = true,
        });

        setStatus("Подтвердите вход на открывшемся сайте…");

        var expireTime = DateTimeOffset.UtcNow.AddMinutes(5);

        while (DateTimeOffset.UtcNow < expireTime)
        {
            await Task.Delay(1000, cancellationToken);

            if (File.Exists(tokenPath))
            {
                try
                {
                    var fileInfo = new FileInfo(tokenPath);
                    if (fileInfo.CreationTimeUtc < startTime) continue;
                }
                catch { continue; }

                string token;
                try
                {
                    token = await File.ReadAllTextAsync(tokenPath, cancellationToken);
                }
                catch
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(token))
                {
                    try { File.Delete(tokenPath); } catch { }

                    using var request = new HttpRequestMessage(
                        HttpMethod.Post,
                        $"{config.ApiBaseUrl}/api/cs2/launcher/auth/claim"
                    );
                    request.Content = JsonContent.Create(new { token });
                    using var response = await http.SendAsync(request, cancellationToken);
                    response.EnsureSuccessStatusCode();

                    return await response.Content.ReadFromJsonAsync<LauncherSession>(
                        cancellationToken: cancellationToken
                    ) ?? throw new InvalidOperationException("Сервер не вернул данные сессии.");
                }
            }
        }

        throw new TimeoutException("Время подтверждения входа истекло.");
    }
}
