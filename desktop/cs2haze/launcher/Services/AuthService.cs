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
        var deviceId = GetDeviceId();
        using var startResponse = await http.PostAsJsonAsync(
            $"{config.ApiBaseUrl}/api/cs2/launcher/auth/start",
            new { deviceId, app = "cs2haze" },
            cancellationToken
        );
        startResponse.EnsureSuccessStatusCode();

        var flow = await startResponse.Content.ReadFromJsonAsync<DeviceStartResponse>(
            cancellationToken: cancellationToken
        ) ?? throw new InvalidOperationException("Сервер не вернул данные авторизации.");

        Process.Start(new ProcessStartInfo
        {
            FileName = flow.VerificationUrl,
            UseShellExecute = true,
        });

        setStatus("Подтвердите вход на открывшемся сайте…");

        while (DateTimeOffset.UtcNow < flow.ExpiresAt)
        {
            await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, flow.IntervalSeconds)), cancellationToken);

            using var pollResponse = await http.PostAsJsonAsync(
                $"{config.ApiBaseUrl}/api/cs2/launcher/auth/poll",
                new { deviceCode = flow.DeviceCode, deviceId },
                cancellationToken
            );

            if (!pollResponse.IsSuccessStatusCode) continue;

            var poll = await pollResponse.Content.ReadFromJsonAsync<DevicePollResponse>(
                cancellationToken: cancellationToken
            );
            if (poll is null || poll.Status == "pending") continue;
            if (poll.Status == "denied") throw new InvalidOperationException("Вход отклонён.");
            if (poll.Status != "approved" || string.IsNullOrWhiteSpace(poll.AccessToken))
                continue;

            using var sessionRequest = new HttpRequestMessage(
                HttpMethod.Get,
                $"{config.ApiBaseUrl}/api/cs2/launcher/session"
            );
            sessionRequest.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", poll.AccessToken);

            using var sessionResponse = await http.SendAsync(sessionRequest, cancellationToken);
            sessionResponse.EnsureSuccessStatusCode();

            var session = await sessionResponse.Content.ReadFromJsonAsync<LauncherSession>(
                cancellationToken: cancellationToken
            ) ?? throw new InvalidOperationException("Не удалось получить сессию.");

            session.AccessToken = poll.AccessToken;
            session.RefreshToken = poll.RefreshToken;
            return session;
        }

        throw new TimeoutException("Время подтверждения входа истекло.");
    }

    private static string GetDeviceId()
    {
        var raw = $"{Environment.MachineName}|{Environment.UserName}|cs2haze";
        return Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(raw)
            )
        ).ToLowerInvariant();
    }
}
