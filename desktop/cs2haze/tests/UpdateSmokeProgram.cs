using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Diagnostics;
using CS2Haze.Launcher.Models;
using CS2Haze.Launcher.Services;
using CS2Haze.Updater;

if (RunReadyFixtureIfRequested(args)) return;

var root = Path.Combine(Path.GetTempPath(), "cs2haze-update-smoke-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);

try
{
    if (!UpdateService.IsLauncherUpdateAvailable("1.0.3", "1.0.4"))
        throw new InvalidOperationException("A newer launcher version was not detected.");
    if (UpdateService.IsLauncherUpdateAvailable("1.0.4", "1.0.4"))
        throw new InvalidOperationException("The current launcher version was treated as newer.");
    if (UpdateService.IsLauncherUpdateAvailable("1.0.4", "1.0.4.0"))
        throw new InvalidOperationException("Equivalent four-part version caused an update loop.");
    if (!UpdateService.IsLauncherUpdateAvailable("1.0.4.0", "1.0.4.1"))
        throw new InvalidOperationException("A newer revision was not detected.");
    if (!UpdateService.IsAllowedLauncherUrl(
        "https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/latest/download/cs2haze-launcher.zip"
    ))
        throw new InvalidOperationException("The official latest update URL was rejected.");
    if (!UpdateService.IsAllowedLauncherUrl(
        "https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/download/cs2haze-v2.0.6.6/cs2haze-launcher.zip"
    ))
        throw new InvalidOperationException("The official tagged update URL was rejected.");
    if (UpdateService.IsAllowedLauncherUrl("https://example.com/cs2haze-launcher.zip"))
        throw new InvalidOperationException("A third-party update URL was accepted.");

    var testExecutable = Path.Combine(AppContext.BaseDirectory, "CS2Haze.UpdateSmoke.exe");
    if (!File.Exists(testExecutable))
        throw new InvalidOperationException("The test executable path is unavailable.");
    var versionInfo = FileVersionInfo.GetVersionInfo(testExecutable);
    var packageVersion = $"{versionInfo.FileMajorPart}.{versionInfo.FileMinorPart}.{versionInfo.FileBuildPart}";
    var newLauncherBytes = File.ReadAllBytes(testExecutable);

    var archivePath = Path.Combine(root, "launcher.zip");
    CreatePackage(archivePath, packageVersion, testExecutable, malicious: false);
    var archiveBytes = File.ReadAllBytes(archivePath);
    var archiveSha256 = Convert.ToHexString(SHA256.HashData(archiveBytes)).ToLowerInvariant();

    var installed = Path.Combine(root, "installed");
    Directory.CreateDirectory(Path.Combine(installed, "runtime"));
    File.WriteAllText(Path.Combine(installed, "cs2haze.exe"), "old launcher");
    File.WriteAllText(Path.Combine(installed, "cs2haze-updater.exe"), "old updater");
    File.WriteAllText(Path.Combine(installed, "launcher-config.json"), "custom config");
    File.WriteAllText(Path.Combine(installed, "runtime", "cs2-agent.js"), "runtime preserved");

    var http = new HttpClient(new StaticResponseHandler(archiveBytes));
    var updateService = new UpdateService(http, new LauncherConfig());
    var manifest = new UpdateManifest
    {
        LauncherVersion = packageVersion,
        LauncherUrl = "https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/latest/download/cs2haze-launcher.zip",
        LauncherSha256 = archiveSha256,
    };
    var prepared = await updateService.PrepareLauncherUpdateAsync(
        manifest,
        installed,
        Path.Combine(root, "data"),
        new Progress<int>(),
        CancellationToken.None
    );
    if (!File.Exists(prepared.ArchivePath)
        || !File.Exists(prepared.UpdaterPath)
        || !File.Exists(prepared.RecoveryUpdaterPath))
        throw new InvalidOperationException("Launcher update was not prepared.");

    using (var pending = UpdateInstaller.ApplyArchive(
        prepared.ArchivePath,
        installed,
        packageVersion
    ))
    {
        AssertInstalledFiles(installed, newLauncherBytes);
    }
    AssertInstalledFiles(installed, Encoding.UTF8.GetBytes("old launcher"));

    var interrupted = UpdateInstaller.ApplyArchive(
        prepared.ArchivePath,
        installed,
        packageVersion
    );
    AssertInstalledFiles(installed, newLauncherBytes);
    UpdateInstaller.RecoverInterruptedUpdate(
        Path.GetDirectoryName(prepared.ArchivePath)!,
        installed
    );
    AssertInstalledFiles(installed, Encoding.UTF8.GetBytes("old launcher"));
    interrupted.Dispose();

    var committedCleanup = UpdateInstaller.ApplyArchive(
        prepared.ArchivePath,
        installed,
        packageVersion
    );
    var transactionPath = Path.Combine(
        Path.GetDirectoryName(prepared.ArchivePath)!,
        "pending-launcher-update.json"
    );
    UpdateInstaller.MarkTransactionCommitted(transactionPath);
    UpdateInstaller.RecoverInterruptedUpdate(
        Path.GetDirectoryName(prepared.ArchivePath)!,
        installed
    );
    AssertInstalledFiles(installed, newLauncherBytes);
    committedCleanup.Dispose();

    File.WriteAllText(transactionPath + ".committed", "stale-transaction");

    using (var committed = UpdateInstaller.ApplyArchive(
        prepared.ArchivePath,
        installed,
        packageVersion
    ))
    {
        committed.Commit();
    }
    AssertInstalledFiles(installed, newLauncherBytes);

    var corruptInstalled = CreateOldInstallation(root, "corrupt-installed");
    var corruptTransaction = UpdateInstaller.ApplyArchive(
        prepared.ArchivePath,
        corruptInstalled,
        packageVersion
    );
    File.WriteAllText(transactionPath, "{broken journal");
    UpdateInstaller.RecoverInterruptedUpdate(
        Path.GetDirectoryName(prepared.ArchivePath)!,
        corruptInstalled
    );
    AssertInstalledFiles(corruptInstalled, Encoding.UTF8.GetBytes("old launcher"));
    corruptTransaction.Dispose();

    var maliciousArchive = Path.Combine(root, "malicious.zip");
    CreatePackage(maliciousArchive, packageVersion, testExecutable, malicious: true);
    try
    {
        using var _ = UpdateInstaller.ApplyArchive(maliciousArchive, installed, packageVersion);
        throw new InvalidOperationException("An unsafe archive path was accepted.");
    }
    catch (InvalidOperationException ex) when (ex.Message.Contains("небезопасный путь"))
    {
    }

    var updaterArgument = GetArgumentValue(args, "--updater=");
    if (!string.IsNullOrWhiteSpace(updaterArgument))
        await RunUpdaterLifecycleSmokeAsync(
            root,
            Path.GetFullPath(updaterArgument),
            testExecutable,
            packageVersion,
            newLauncherBytes
        );

    Console.WriteLine("cs2haze update smoke passed.");
}
finally
{
    try
    {
        if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
    }
    catch { }
}

static bool RunReadyFixtureIfRequested(string[] args)
{
    if (File.Exists(Path.Combine(AppContext.BaseDirectory, "fixture-exit.txt"))) return true;

    var readyPath = GetArgumentValue(args, "--update-ready=");
    if (string.IsNullOrWhiteSpace(readyPath)) return false;

    if (File.Exists(Path.Combine(AppContext.BaseDirectory, "fixture-no-ready.txt"))) return true;

    var expectedVersion = GetArgumentValue(args, "--update-version=") ?? "";
    File.WriteAllText(readyPath, expectedVersion, new UTF8Encoding(false));

    var cleanupPath = GetArgumentValue(args, "--cleanup-updater=");
    if (!string.IsNullOrWhiteSpace(cleanupPath))
    {
        for (var attempt = 0; attempt < 30; attempt++)
        {
            try
            {
                if (!File.Exists(cleanupPath)) break;
                File.Delete(cleanupPath);
                break;
            }
            catch (IOException)
            {
                Thread.Sleep(100);
            }
        }
    }

    return true;
}

static async Task RunUpdaterLifecycleSmokeAsync(
    string root,
    string updaterPath,
    string testExecutable,
    string packageVersion,
    byte[] expectedLauncher
)
{
    if (!File.Exists(updaterPath))
        throw new FileNotFoundException("Standalone updater was not found.", updaterPath);

    var lifecycleRoot = Path.Combine(root, "lifecycle");
    Directory.CreateDirectory(lifecycleRoot);

    var successTarget = CreateOldInstallation(lifecycleRoot, "success");
    var successArchive = Path.Combine(lifecycleRoot, "success.zip");
    CreateLifecyclePackage(
        successArchive,
        packageVersion,
        testExecutable,
        updaterPath,
        failReady: false
    );
    var successExitCode = await RunStandaloneUpdaterAsync(
        lifecycleRoot,
        updaterPath,
        successArchive,
        successTarget,
        packageVersion
    );
    if (successExitCode != 0)
        throw new InvalidOperationException("Standalone updater did not complete successfully.");
    AssertInstalledFiles(successTarget, expectedLauncher);

    var failureTarget = CreateOldInstallation(lifecycleRoot, "failure");
    var failureArchive = Path.Combine(lifecycleRoot, "failure.zip");
    CreateLifecyclePackage(
        failureArchive,
        packageVersion,
        testExecutable,
        updaterPath,
        failReady: true
    );
    var failureExitCode = await RunStandaloneUpdaterAsync(
        lifecycleRoot,
        updaterPath,
        failureArchive,
        failureTarget,
        packageVersion
    );
    if (failureExitCode == 0)
        throw new InvalidOperationException("Updater accepted a launcher that never became ready.");
    AssertInstalledFiles(failureTarget, Encoding.UTF8.GetBytes("old launcher"));

    var recoveryTarget = CreateFixtureInstallation(
        lifecycleRoot,
        "recover-only",
        testExecutable
    );
    var recoveryArchive = Path.Combine(lifecycleRoot, "recover-only.zip");
    CreateLifecyclePackage(
        recoveryArchive,
        packageVersion,
        testExecutable,
        updaterPath,
        failReady: false
    );
    var pendingRecovery = UpdateInstaller.ApplyArchive(
        recoveryArchive,
        recoveryTarget,
        packageVersion
    );
    if (File.ReadAllText(Path.Combine(recoveryTarget, "version-marker.txt")) != "new")
        throw new InvalidOperationException("Recovery fixture was not replaced before interruption.");

    var recoverOnlyExitCode = await RunRecoveryBootstrapAsync(
        lifecycleRoot,
        updaterPath,
        Path.GetDirectoryName(recoveryArchive)!,
        recoveryTarget
    );
    if (recoverOnlyExitCode != 0)
        throw new InvalidOperationException("RunOnce recovery bootstrap failed.");
    if (File.ReadAllText(Path.Combine(recoveryTarget, "version-marker.txt")) != "old")
        throw new InvalidOperationException("RunOnce recovery did not restore the saved installation.");
    pendingRecovery.Dispose();
}

static string CreateOldInstallation(string root, string name)
{
    var installed = Path.Combine(root, name);
    Directory.CreateDirectory(Path.Combine(installed, "runtime"));
    File.WriteAllText(Path.Combine(installed, "cs2haze.exe"), "old launcher");
    File.WriteAllText(Path.Combine(installed, "cs2haze-updater.exe"), "old updater");
    File.WriteAllText(Path.Combine(installed, "launcher-config.json"), "custom config");
    File.WriteAllText(Path.Combine(installed, "runtime", "cs2-agent.js"), "runtime preserved");
    return installed;
}

static string CreateFixtureInstallation(string root, string name, string executablePath)
{
    var installed = CreateOldInstallation(root, name);
    File.Copy(executablePath, Path.Combine(installed, "cs2haze.exe"), overwrite: true);
    foreach (var extension in new[] { ".dll", ".deps.json", ".runtimeconfig.json" })
    {
        var dependency = Path.Combine(AppContext.BaseDirectory, "CS2Haze.UpdateSmoke" + extension);
        if (File.Exists(dependency))
            File.Copy(dependency, Path.Combine(installed, Path.GetFileName(dependency)), overwrite: true);
    }
    File.WriteAllText(Path.Combine(installed, "fixture-exit.txt"), "exit");
    File.WriteAllText(Path.Combine(installed, "version-marker.txt"), "old");
    return installed;
}

static void CreateLifecyclePackage(
    string path,
    string version,
    string executablePath,
    string updaterPath,
    bool failReady
)
{
    using var file = File.Create(path);
    using var archive = new ZipArchive(file, ZipArchiveMode.Create);
    AddText(archive, "launcher-update.json", $"{{\"launcherVersion\":\"{version}\",\"entryPoint\":\"cs2haze.exe\"}}");
    AddFile(archive, "cs2haze.exe", executablePath);
    AddFile(archive, "cs2haze-updater.exe", updaterPath);
    foreach (var extension in new[] { ".dll", ".deps.json", ".runtimeconfig.json" })
    {
        var dependency = Path.Combine(AppContext.BaseDirectory, "CS2Haze.UpdateSmoke" + extension);
        if (File.Exists(dependency)) AddFile(archive, Path.GetFileName(dependency), dependency);
    }
    AddText(archive, "launcher-config.json", "default config");
    AddText(archive, "version-marker.txt", "new");
    if (failReady) AddText(archive, "fixture-no-ready.txt", "fail");
}

static async Task<int> RunStandaloneUpdaterAsync(
    string root,
    string updaterPath,
    string archivePath,
    string targetDirectory,
    string expectedVersion
)
{
    var bootstrapPath = Path.Combine(root, $"updater-lifecycle-{Guid.NewGuid():N}.exe");
    var recoveryPath = Path.Combine(root, $"updater-recovery-{Guid.NewGuid():N}.exe");
    File.Copy(updaterPath, bootstrapPath);
    File.Copy(updaterPath, recoveryPath);
    var startInfo = new ProcessStartInfo
    {
        FileName = bootstrapPath,
        UseShellExecute = false,
    };
    startInfo.ArgumentList.Add("--pid=2147483647");
    startInfo.ArgumentList.Add($"--archive={archivePath}");
    startInfo.ArgumentList.Add($"--target={targetDirectory}");
    startInfo.ArgumentList.Add($"--expected-version={expectedVersion}");
    startInfo.ArgumentList.Add($"--recovery-bootstrap={recoveryPath}");
    startInfo.ArgumentList.Add("--silent=true");
    startInfo.ArgumentList.Add("--skip-runonce=true");

    using var updater = Process.Start(startInfo)
        ?? throw new InvalidOperationException("Could not start the standalone updater.");
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
    await updater.WaitForExitAsync(timeout.Token);
    await Task.Delay(500);
    return updater.ExitCode;
}

static async Task<int> RunRecoveryBootstrapAsync(
    string root,
    string updaterPath,
    string updatesDirectory,
    string targetDirectory
)
{
    var bootstrapPath = Path.Combine(root, $"updater-recover-only-{Guid.NewGuid():N}.exe");
    File.Copy(updaterPath, bootstrapPath);
    var startInfo = new ProcessStartInfo
    {
        FileName = bootstrapPath,
        UseShellExecute = false,
    };
    startInfo.ArgumentList.Add($"--recover-only={updatesDirectory}");
    startInfo.ArgumentList.Add($"--target={targetDirectory}");
    startInfo.ArgumentList.Add("--silent=true");
    startInfo.ArgumentList.Add("--skip-runonce=true");

    using var updater = Process.Start(startInfo)
        ?? throw new InvalidOperationException("Could not start the recovery bootstrap.");
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
    await updater.WaitForExitAsync(timeout.Token);
    await Task.Delay(500);
    return updater.ExitCode;
}

static string? GetArgumentValue(string[] args, string prefix)
{
    return args
        .FirstOrDefault(arg => arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        ?[prefix.Length..]
        .Trim(' ', '"', '\'');
}

static void AssertInstalledFiles(string installed, byte[] expectedLauncher)
{
    if (!File.ReadAllBytes(Path.Combine(installed, "cs2haze.exe")).SequenceEqual(expectedLauncher))
        throw new InvalidOperationException("Launcher files were not swapped as expected.");
    if (File.ReadAllText(Path.Combine(installed, "launcher-config.json")) != "custom config")
        throw new InvalidOperationException("The user's launcher config was overwritten.");
    if (File.ReadAllText(Path.Combine(installed, "runtime", "cs2-agent.js")) != "runtime preserved")
        throw new InvalidOperationException("The installed runtime was not preserved.");
}

static void CreatePackage(string path, string version, string executablePath, bool malicious)
{
    using var file = File.Create(path);
    using var archive = new ZipArchive(file, ZipArchiveMode.Create);
    AddText(archive, "launcher-update.json", $"{{\"launcherVersion\":\"{version}\",\"entryPoint\":\"cs2haze.exe\"}}");
    AddFile(archive, "cs2haze.exe", executablePath);
    AddFile(archive, "cs2haze-updater.exe", executablePath);
    AddText(archive, "launcher-config.json", "default config");
    AddText(archive, "Assets/cs2haze.ico", "icon");
    if (malicious) AddText(archive, "../escaped.txt", "unsafe");
}

static void AddFile(ZipArchive archive, string name, string sourcePath)
{
    var entry = archive.CreateEntry(name, CompressionLevel.Fastest);
    using var input = File.OpenRead(sourcePath);
    using var output = entry.Open();
    input.CopyTo(output);
}

static void AddText(ZipArchive archive, string name, string value)
{
    var entry = archive.CreateEntry(name);
    using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
    writer.Write(value);
}

sealed class StaticResponseHandler(byte[] content) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken
    )
    {
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(content),
            RequestMessage = request,
        };
        return Task.FromResult(response);
    }
}
