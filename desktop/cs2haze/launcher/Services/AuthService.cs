using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using CS2Haze.Launcher.Models;

namespace CS2Haze.Launcher.Services;

public sealed class AuthService(HttpClient http, LauncherConfig config, StorageService storage)
{
    private string GetValidBaseUrl(Action<string>? setStatus = null)
    {
        var state = storage.LoadState();
        if (string.IsNullOrWhiteSpace(state.SelectedBaseUrl))
        {
            return config.ApiBaseUrl;
        }

        var allowlist = new[]
        {
            "https://paracetamolhaze.ru",
            "https://paracetamolhaze.online",
            "https://paracetamolhaze-six.vercel.app"
        };

        foreach (var allowed in allowlist)
        {
            if (string.Equals(state.SelectedBaseUrl, allowed, StringComparison.OrdinalIgnoreCase))
            {
                return state.SelectedBaseUrl;
            }
        }

        state.SelectedBaseUrl = null;
        storage.SaveState(state);
        setStatus?.Invoke("Ранее сохранённый домен больше не поддерживается. Используется основной сервер.");
        return config.ApiBaseUrl;
    }

    public async Task<LauncherSession?> TryRestoreSessionAsync(
        LocalState state,
        CancellationToken cancellationToken
    )
    {
        var refreshToken = storage.Unprotect(state.ProtectedRefreshToken);
        if (string.IsNullOrWhiteSpace(refreshToken)) return null;

        var baseUrl = GetValidBaseUrl();

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{baseUrl}/api/cs2/launcher/auth/refresh"
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

        var baseUrl = GetValidBaseUrl(setStatus);
        var connectUrl = $"{baseUrl.TrimEnd('/')}/cs2haze/connect";
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
        var pending = tokenStore.Read();
        if (pending == null || string.IsNullOrWhiteSpace(pending.Token)) return null;

        var baseUrl = pending.Origin ?? GetValidBaseUrl();

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{baseUrl}/api/cs2/launcher/auth/claim"
        );
        request.Content = JsonContent.Create(new { token = pending.Token });

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
                tokenStore.DeleteIfMatches(pending.Token);
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
            
            if (!string.IsNullOrWhiteSpace(pending.Origin))
            {
                var state = storage.LoadState();
                state.SelectedBaseUrl = pending.Origin;
                storage.SaveState(state);
            }
            
            tokenStore.DeleteIfMatches(pending.Token);
            return session;
        }
    }
}
