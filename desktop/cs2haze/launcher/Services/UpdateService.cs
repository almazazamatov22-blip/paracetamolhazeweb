using System.IO.Compression;
using System.Net.Http.Json;
using System.Security.Cryptography;
using CS2Haze.Launcher.Models;

namespace CS2Haze.Launcher.Services;

public sealed class UpdateService(HttpClient http, LauncherConfig config)
{
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

        return await http.GetFromJsonAsync<UpdateManifest>(url, cancellationToken)
            ?? throw new InvalidOperationException("Пустой манифест обновления.");
    }

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

            var actualHash = Convert.ToHexString(
                await SHA256.HashDataAsync(File.OpenRead(archivePath), cancellationToken)
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
}
