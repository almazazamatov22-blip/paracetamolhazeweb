using System.Text.Json.Serialization;

namespace CS2Haze.Launcher.Models;

public sealed class LauncherConfig
{
    public string ApiBaseUrl { get; set; } = "https://paracetamolhaze.ru";
    public string AgentBaseUrl { get; set; } = "https://paracetamolhaze.ru";
    public string ManifestPath { get; set; } = "/api/cs2/launcher/manifest";
    public bool RequireAuthentication { get; set; } = false;
    public bool RequireSubscription { get; set; } = false;
}

public sealed class LocalState
{
    public string? ProtectedRefreshToken { get; set; }
    public string? StreamerId { get; set; }
    public string? DisplayName { get; set; }
    public string? RuntimeVersion { get; set; }
    public string? SelectedBaseUrl { get; set; }
}

public sealed class UpdateManifest
{
    public string LauncherVersion { get; set; } = "1.0.0";
    public string RuntimeVersion { get; set; } = "2.0.6";
    public bool Mandatory { get; set; } = true;
    public string? RuntimeUrl { get; set; }
    public string? RuntimeSha256 { get; set; }
    public string? LauncherUrl { get; set; }
    public string? LauncherSha256 { get; set; }
    public bool RequireAuthentication { get; set; }
    public bool RequireSubscription { get; set; }
}

public sealed class DeviceStartResponse
{
    public string DeviceCode { get; set; } = "";
    public string VerificationUrl { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public int IntervalSeconds { get; set; } = 2;
}

public sealed class DevicePollResponse
{
    public string Status { get; set; } = "pending";
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
}

public sealed class LauncherSession
{
    public bool Access { get; set; }
    public bool SubscriptionActive { get; set; }
    public string? Plan { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public string? StreamerId { get; set; }
    public string? DisplayName { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
}
