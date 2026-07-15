using System.IO.Compression;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Diagnostics;
using System.Reflection;
using Microsoft.Win32;
using CS2Haze.Launcher.Models;

namespace CS2Haze.Launcher.Services;

public sealed record PreparedLauncherUpdate(
    string ArchivePath,
    string UpdaterPath,
    string RecoveryUpdaterPath
);

public sealed class UpdateService(HttpClient http, LauncherConfig config)
{
    private const long MaxLauncherArchiveBytes = 512L * 1024 * 1024;
    private const string RunOnceKeyPath = @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
    private const string RunOnceValueName = "cs2haze launcher recovery";
    private const string DefaultUpdateRepository = "almazazamatov22-blip/paracetamolhazeweb";
    private static readonly string UpdateRepository = GetUpdateRepository();

    public async Task<UpdateManifest> GetManifestAsync(
        string launcherVersion,
        string? runtimeVersion,
        CancellationToken cancellationToken
    )
    {
        var url =
            $"{config.ApiBaseUrl}{config.ManifestPath}"
            + $"?platform=win-x64&launcherVersion={Uri.EscapeDataString(launcherVersion)}"
            + $"&runtimeVersion={Uri.EscapeDataString(runtimeVersion ?? "")}";

        using var response = await http.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Сервер обновлений вернул HTTP {(int)response.StatusCode}: {responseBody}");
        }

        return await response.Content.ReadFromJsonAsync<UpdateManifest>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("Пустой манифест обновления.");
    }

    public static bool IsLauncherUpdateAvailable(string currentVersion, string availableVersion)
    {
        if (!TryNormalizeVersion(currentVersion, out var current))
            throw new InvalidOperationException(
                $"Не удалось определить текущую версию лаунчера: {currentVersion}."
            );
        if (!TryNormalizeVersion(availableVersion, out var available))
            throw new InvalidOperationException(
                $"Сервер вернул некорректную версию лаунчера: {availableVersion}."
            );

        return available > current;
    }

    public async Task<PreparedLauncherUpdate> PrepareLauncherUpdateAsync(
        UpdateManifest manifest,
        string installDirectory,
        string dataDirectory,
        IProgress<int> progress,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(manifest.LauncherUrl))
            throw new InvalidOperationException(
                "Для новой версии не указан адрес пакета обновления лаунчера."
            );
        if (!IsAllowedLauncherUrl(manifest.LauncherUrl, out var launcherUri))
        {
            throw new InvalidOperationException(
                "Адрес пакета обновления не относится к официальному релизу cs2haze."
            );
        }
        if (!IsValidSha256(manifest.LauncherSha256))
            throw new InvalidOperationException(
                "Для пакета обновления отсутствует корректная контрольная сумма SHA-256."
            );

        var installedUpdater = Path.Combine(installDirectory, "cs2haze-updater.exe");
        if (!File.Exists(installedUpdater))
            throw new FileNotFoundException(
                "Не найден модуль автоматического обновления. Переустановите cs2haze с сайта.",
                installedUpdater
            );

        var updatesDirectory = Path.Combine(dataDirectory, "updates");
        Directory.CreateDirectory(updatesDirectory);
        CleanupOldUpdateFiles(updatesDirectory);

        var updateId = Guid.NewGuid().ToString("N");
        var archivePath = Path.Combine(
            updatesDirectory,
            $"launcher-{manifest.LauncherVersion}-{updateId}.zip"
        );
        var updaterPath = Path.Combine(updatesDirectory, $"updater-runner-{updateId}.exe");
        var recoveryUpdaterPath = Path.Combine(
            updatesDirectory,
            $"updater-recovery-{updateId}.exe"
        );

        try
        {
            await DownloadAndVerifyAsync(
                launcherUri,
                manifest.LauncherSha256!,
                archivePath,
                progress,
                cancellationToken
            );
            File.Copy(installedUpdater, updaterPath, overwrite: false);
            File.Copy(installedUpdater, recoveryUpdaterPath, overwrite: false);
            return new PreparedLauncherUpdate(archivePath, updaterPath, recoveryUpdaterPath);
        }
        catch
        {
            TryDelete(archivePath);
            TryDelete(updaterPath);
            TryDelete(recoveryUpdaterPath);
            throw;
        }
    }

    public void StartLauncherUpdater(
        PreparedLauncherUpdate update,
        string installDirectory,
        string expectedVersion
    )
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = update.UpdaterPath,
            WorkingDirectory = Path.GetDirectoryName(update.UpdaterPath)!,
            UseShellExecute = true,
        };
        startInfo.ArgumentList.Add($"--pid={Environment.ProcessId}");
        startInfo.ArgumentList.Add($"--archive={update.ArchivePath}");
        startInfo.ArgumentList.Add($"--target={installDirectory}");
        startInfo.ArgumentList.Add($"--expected-version={expectedVersion}");
        startInfo.ArgumentList.Add($"--recovery-bootstrap={update.RecoveryUpdaterPath}");

        RegisterRecoveryRunOnce(update.RecoveryUpdaterPath, installDirectory);
        try
        {
            if (Process.Start(startInfo) is null)
                throw new InvalidOperationException("Не удалось запустить модуль обновления.");
        }
        catch
        {
            RemoveRecoveryRunOnce();
            throw;
        }
    }

    public static bool IsAllowedLauncherUrl(string? value) =>
        IsAllowedLauncherUrl(value, out _);

    public async Task InstallRuntimeAsync(
        UpdateManifest manifest,
        string installDirectory,
        IProgress<int> progress,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(manifest.RuntimeUrl)) return;
        if (string.IsNullOrWhiteSpace(manifest.RuntimeSha256))
            throw new InvalidOperationException("В манифесте отсутствует SHA-256 runtime.");

        var tempRoot = Path.Combine(Path.GetTempPath(), "cs2haze-update-" + Guid.NewGuid().ToString("N"));
        var archivePath = Path.Combine(tempRoot, "runtime.zip");
        var stagingPath = Path.Combine(tempRoot, "runtime");
        Directory.CreateDirectory(tempRoot);

        try
        {
            using var response = await http.GetAsync(
                manifest.RuntimeUrl,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken
            );
            response.EnsureSuccessStatusCode();

            var total = response.Content.Headers.ContentLength ?? 0;
            await using (var input = await response.Content.ReadAsStreamAsync(cancellationToken))
            await using (var output = File.Create(archivePath))
            {
                var buffer = new byte[1024 * 128];
                long readTotal = 0;
                while (true)
                {
                    var count = await input.ReadAsync(buffer, cancellationToken);
                    if (count == 0) break;
                    await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
                    readTotal += count;
                    if (total > 0)
                        progress.Report((int)Math.Clamp(readTotal * 100 / total, 0, 100));
                }
            }

            await using var archiveStream = File.OpenRead(archivePath);
            var actualHash = Convert.ToHexString(
                await SHA256.HashDataAsync(archiveStream, cancellationToken)
            ).ToLowerInvariant();
            if (!actualHash.Equals(manifest.RuntimeSha256, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("SHA-256 обновления не совпадает.");

            ZipFile.ExtractToDirectory(archivePath, stagingPath);

            var required = new[]
            {
                Path.Combine(stagingPath, "node.exe"),
                Path.Combine(stagingPath, "cs2-agent.js"),
            };
            if (required.Any(path => !File.Exists(path)))
                throw new InvalidOperationException("Runtime-архив повреждён.");

            var runtimeDirectory = Path.Combine(installDirectory, "runtime");
            var oldDirectory = runtimeDirectory + ".old";

            if (Directory.Exists(oldDirectory)) Directory.Delete(oldDirectory, true);
            if (Directory.Exists(runtimeDirectory)) Directory.Move(runtimeDirectory, oldDirectory);
            Directory.Move(stagingPath, runtimeDirectory);
            if (Directory.Exists(oldDirectory)) Directory.Delete(oldDirectory, true);

            progress.Report(100);
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempRoot)) Directory.Delete(tempRoot, true);
            }
            catch { }
        }
    }

    private async Task DownloadAndVerifyAsync(
        Uri url,
        string expectedSha256,
        string destination,
        IProgress<int> progress,
        CancellationToken cancellationToken
    )
    {
        using var response = await http.GetAsync(
            url,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken
        );
        response.EnsureSuccessStatusCode();

        var total = response.Content.Headers.ContentLength;
        if (total > MaxLauncherArchiveBytes)
            throw new InvalidOperationException("Пакет обновления лаунчера слишком большой.");

        await using (var input = await response.Content.ReadAsStreamAsync(cancellationToken))
        await using (var output = File.Create(destination))
        {
            var buffer = new byte[1024 * 128];
            long readTotal = 0;
            while (true)
            {
                var count = await input.ReadAsync(buffer, cancellationToken);
                if (count == 0) break;

                readTotal += count;
                if (readTotal > MaxLauncherArchiveBytes)
                    throw new InvalidOperationException("Пакет обновления лаунчера слишком большой.");

                await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
                if (total is > 0)
                    progress.Report((int)Math.Clamp(readTotal * 100 / total.Value, 0, 100));
            }
        }

        await using var file = File.OpenRead(destination);
        var actualSha256 = Convert.ToHexString(
            await SHA256.HashDataAsync(file, cancellationToken)
        ).ToLowerInvariant();
        if (!actualSha256.Equals(expectedSha256, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                "Контрольная сумма пакета обновления не совпадает. Обновление отменено."
            );

        progress.Report(100);
    }

    private static bool IsValidSha256(string? value)
    {
        return value is { Length: 64 } && value.All(Uri.IsHexDigit);
    }

    private static bool TryNormalizeVersion(string value, out Version normalized)
    {
        normalized = new Version(0, 0, 0, 0);
        if (!Version.TryParse(value, out var parsed)) return false;
        normalized = new Version(
            parsed.Major,
            parsed.Minor,
            Math.Max(parsed.Build, 0),
            Math.Max(parsed.Revision, 0)
        );
        return true;
    }

    private static bool IsAllowedLauncherUrl(string? value, out Uri launcherUri)
    {
        launcherUri = null!;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var parsed)
            || parsed.Scheme != Uri.UriSchemeHttps
            || !parsed.IsDefaultPort
            || !string.Equals(parsed.Host, "github.com", StringComparison.OrdinalIgnoreCase)
            || !string.IsNullOrEmpty(parsed.UserInfo)
            || !string.IsNullOrEmpty(parsed.Query)
            || !string.IsNullOrEmpty(parsed.Fragment))
        {
            return false;
        }

        var prefix = $"/{UpdateRepository}/releases/";
        if (!parsed.AbsolutePath.StartsWith(prefix, StringComparison.Ordinal)) return false;

        var parts = parsed.AbsolutePath[prefix.Length..].Split('/', StringSplitOptions.RemoveEmptyEntries);
        var isLatest = parts is ["latest", "download", "cs2haze-launcher.zip"];
        var isTagged = parts.Length == 3
            && string.Equals(parts[0], "download", StringComparison.Ordinal)
            && parts[1].StartsWith("cs2haze-v", StringComparison.Ordinal)
            && string.Equals(parts[2], "cs2haze-launcher.zip", StringComparison.Ordinal);
        if (!isLatest && !isTagged) return false;

        launcherUri = parsed;
        return true;
    }

    private static string GetUpdateRepository()
    {
        var configured = typeof(UpdateService).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .FirstOrDefault(attribute => attribute.Key == "Cs2HazeUpdateRepository")
            ?.Value;
        if (string.IsNullOrWhiteSpace(configured)) return DefaultUpdateRepository;

        var parts = configured.Split('/');
        if (parts.Length != 2 || parts.Any(part =>
            string.IsNullOrWhiteSpace(part)
            || part.Any(character => !(char.IsLetterOrDigit(character)
                || character is '-' or '_' or '.'))))
        {
            throw new InvalidOperationException(
                "Некорректный репозиторий канала обновлений CS2Haze."
            );
        }

        return configured;
    }

    private static void RegisterRecoveryRunOnce(string updaterPath, string installDirectory)
    {
        updaterPath = Path.GetFullPath(updaterPath);
        var updatesDirectory = Path.GetDirectoryName(updaterPath)!
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        installDirectory = Path.GetFullPath(installDirectory)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var command =
            $"\"{updaterPath}\" --recover-only=\"{updatesDirectory}\" --target=\"{installDirectory}\"";
        using var key = Registry.CurrentUser.CreateSubKey(RunOnceKeyPath, writable: true)
            ?? throw new InvalidOperationException("Не удалось включить аварийное восстановление обновления.");
        key.SetValue(RunOnceValueName, command, RegistryValueKind.String);
    }

    private static void RemoveRecoveryRunOnce()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RunOnceKeyPath, writable: true);
            key?.DeleteValue(RunOnceValueName, throwOnMissingValue: false);
        }
        catch { }
    }

    private static void CleanupOldUpdateFiles(string updatesDirectory)
    {
        var cutoff = DateTime.UtcNow.AddDays(-7);
        foreach (var path in Directory.EnumerateFiles(updatesDirectory))
        {
            try
            {
                if (File.GetLastWriteTimeUtc(path) < cutoff) File.Delete(path);
            }
            catch { }
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch { }
    }
}
