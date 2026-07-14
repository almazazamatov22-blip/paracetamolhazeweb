using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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
        var tokenStore = new PendingConnectTokenStore(storage.DataDirectory);
        var pendingSession = await TryClaimPendingTokenAsync(tokenStore, cancellationToken);
        if (pendingSession is not null) return pendingSession;

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
            pendingSession = await TryClaimPendingTokenAsync(tokenStore, cancellationToken);
            if (pendingSession is not null) return pendingSession;
        }

        throw new TimeoutException("Время подтверждения входа истекло.");
    }

    private async Task<LauncherSession?> TryClaimPendingTokenAsync(
        PendingConnectTokenStore tokenStore,
        CancellationToken cancellationToken
    )
    {
        var token = tokenStore.Read();
        if (string.IsNullOrWhiteSpace(token)) return null;

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{config.ApiBaseUrl}/api/cs2/launcher/auth/claim"
        );
        request.Content = JsonContent.Create(new { token });

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return null;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return null;
        }

        using (response)
        {
            if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized)
            {
                tokenStore.DeleteIfMatches(token);
                return null;
            }

            if (response.StatusCode is HttpStatusCode.TooManyRequests
                || (int)response.StatusCode >= 500)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();

            LauncherSession? session;
            try
            {
                session = await response.Content.ReadFromJsonAsync<LauncherSession>(
                    cancellationToken: cancellationToken
                );
            }
            catch (JsonException)
            {
                return null;
            }
            catch (IOException)
            {
                return null;
            }

            if (session is null) return null;
            tokenStore.DeleteIfMatches(token);
            return session;
        }
    }
}
