using System.Diagnostics;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

namespace CS2Haze.Updater;

internal static class Program
{
    private const string RunOnceKeyPath = @"Software\Microsoft\Windows\CurrentVersion\RunOnce";
    private const string RunOnceValueName = "cs2haze launcher recovery";

    [STAThread]
    private static int Main(string[] args)
    {
        var logPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "cs2haze",
            "logs",
            "updater.log"
        );

        void Log(string message)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
                File.AppendAllText(
                    logPath,
                    $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}",
                    new UTF8Encoding(false)
                );
            }
            catch { }
        }

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var arg in args)
        {
            var parts = arg.Split('=', 2);
            if (parts.Length == 2) map[parts[0].TrimStart('-')] = parts[1].Trim('"');
        }

        var silent = map.TryGetValue("silent", out var silentValue)
            && string.Equals(silentValue, "true", StringComparison.OrdinalIgnoreCase);
        var manageRunOnce = !map.TryGetValue("skip-runonce", out var skipRunOnceValue)
            || !string.Equals(skipRunOnceValue, "true", StringComparison.OrdinalIgnoreCase);
        string? updatesDirectory = null;
        string? targetDirectoryForRecovery = null;
        string? recoveryBootstrap = null;

        try
        {
            if (map.TryGetValue("recover-only", out var recoveryDirectory))
            {
                updatesDirectory = Path.GetFullPath(recoveryDirectory);
                var recoveryTarget = Path.GetFullPath(map["target"]);
                targetDirectoryForRecovery = recoveryTarget;
                recoveryBootstrap = Environment.ProcessPath;
                UpdateInstaller.RecoverInterruptedUpdate(
                    updatesDirectory,
                    recoveryTarget,
                    Log
                );
                if (manageRunOnce) RemoveRecoveryRunOnce();
                var recoveredLauncher = Path.Combine(recoveryTarget, "cs2haze.exe");
                if (File.Exists(recoveredLauncher))
                {
                    var recoveryStartInfo = new ProcessStartInfo
                    {
                        FileName = recoveredLauncher,
                        UseShellExecute = true,
                    };
                    if (!string.IsNullOrWhiteSpace(Environment.ProcessPath))
                    {
                        recoveryStartInfo.ArgumentList.Add(
                            $"--cleanup-updater={Environment.ProcessPath}"
                        );
                    }
                    Process.Start(recoveryStartInfo);
                }
                return 0;
            }

            var pid = int.Parse(map["pid"]);
            var archive = Path.GetFullPath(map["archive"]);
            var targetDirectory = Path.GetFullPath(map["target"]);
            var expectedVersion = map["expected-version"];
            var launcherPath = Path.Combine(targetDirectory, "cs2haze.exe");
            updatesDirectory = Path.GetDirectoryName(archive)!;
            targetDirectoryForRecovery = targetDirectory;
            recoveryBootstrap = Path.GetFullPath(map["recovery-bootstrap"]);

            try
            {
                using var launcher = Process.GetProcessById(pid);
                if (!launcher.WaitForExit(30_000))
                    throw new InvalidOperationException(
                        "Лаунчер не завершился вовремя. Обновление отменено."
                    );
            }
            catch (ArgumentException)
            {
            }

            UpdateInstaller.RecoverInterruptedUpdate(
                updatesDirectory,
                targetDirectory,
                Log
            );

            Log($"Начинаем обновление до версии {expectedVersion}.");
            using var appliedUpdate = UpdateInstaller.ApplyArchive(
                archive,
                targetDirectory,
                expectedVersion,
                Log
            );

            var startInfo = new ProcessStartInfo
            {
                FileName = launcherPath,
                UseShellExecute = true,
            };
            var readyPath = Path.Combine(
                updatesDirectory,
                $"ready-{Guid.NewGuid():N}.txt"
            );
            if (!string.IsNullOrWhiteSpace(Environment.ProcessPath))
                startInfo.ArgumentList.Add($"--cleanup-updater={Environment.ProcessPath}");
            startInfo.ArgumentList.Add($"--update-ready={readyPath}");
            startInfo.ArgumentList.Add($"--update-version={expectedVersion}");

            using var updatedLauncher = Process.Start(startInfo);
            if (updatedLauncher is null)
                throw new InvalidOperationException("Не удалось запустить обновлённый лаунчер.");

            if (!WaitForReady(updatedLauncher, readyPath, expectedVersion, TimeSpan.FromSeconds(30)))
            {
                TryStop(updatedLauncher);
                throw new InvalidOperationException(
                    "Обновлённый лаунчер не подтвердил успешный запуск."
                );
            }

            try
            {
                appliedUpdate.Commit();
            }
            catch
            {
                TryStop(updatedLauncher);
                throw;
            }
            if (manageRunOnce) RemoveRecoveryRunOnce();
            TryDelete(recoveryBootstrap);
            TryDelete(readyPath);
            TryDelete(archive);
            Log($"Обновление до версии {expectedVersion} установлено успешно.");

            return 0;
        }
        catch (Exception ex)
        {
            Log($"Ошибка обновления: {ex}");
            if (updatesDirectory is not null
                && targetDirectoryForRecovery is not null
                && UpdateInstaller.HasPendingTransaction(updatesDirectory)
                && !string.IsNullOrWhiteSpace(recoveryBootstrap)
                && manageRunOnce)
            {
                RegisterRecoveryRunOnce(
                    recoveryBootstrap,
                    updatesDirectory,
                    targetDirectoryForRecovery
                );
            }
            else
            {
                if (manageRunOnce) RemoveRecoveryRunOnce();
                if (!string.Equals(
                    recoveryBootstrap,
                    Environment.ProcessPath,
                    StringComparison.OrdinalIgnoreCase
                ) && recoveryBootstrap is not null)
                {
                    TryDelete(recoveryBootstrap);
                }
            }
            if (!silent)
            {
                MessageBox.Show(
                    $"Не удалось обновить cs2haze. Обновление остановлено.\n\n{ex.Message}\n\n"
                        + "Если лаунчер не запускается, установите свежую версию с сайта.",
                    "Обновление cs2haze",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            return 1;
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

    private static bool WaitForReady(
        Process launcher,
        string readyPath,
        string expectedVersion,
        TimeSpan timeout
    )
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (launcher.HasExited) return false;
            try
            {
                if (File.Exists(readyPath)
                    && string.Equals(
                        File.ReadAllText(readyPath).Trim(),
                        expectedVersion,
                        StringComparison.OrdinalIgnoreCase
                    ))
                {
                    return true;
                }
            }
            catch (IOException) { }

            Thread.Sleep(200);
        }

        return false;
    }

    private static void TryStop(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                process.WaitForExit(5_000);
            }
        }
        catch { }
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

    private static void RegisterRecoveryRunOnce(
        string updaterPath,
        string updatesDirectory,
        string targetDirectory
    )
    {
        try
        {
            updaterPath = Path.GetFullPath(updaterPath);
            updatesDirectory = Path.GetFullPath(updatesDirectory)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            targetDirectory = Path.GetFullPath(targetDirectory)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var command =
                $"\"{updaterPath}\" --recover-only=\"{updatesDirectory}\" --target=\"{targetDirectory}\"";
            using var key = Registry.CurrentUser.CreateSubKey(RunOnceKeyPath, writable: true);
            key?.SetValue(RunOnceValueName, command, RegistryValueKind.String);
        }
        catch { }
    }
}
