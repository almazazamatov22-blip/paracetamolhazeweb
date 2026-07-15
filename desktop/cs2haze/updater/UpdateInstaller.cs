using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace CS2Haze.Updater;

public sealed class AppliedLauncherUpdate : IDisposable
{
    private readonly string targetDirectory;
    private readonly string backupDirectory;
    private readonly string statePath;
    private bool completed;

    internal AppliedLauncherUpdate(
        string targetDirectory,
        string backupDirectory,
        string statePath
    )
    {
        this.targetDirectory = targetDirectory;
        this.backupDirectory = backupDirectory;
        this.statePath = statePath;
    }

    public void Commit()
    {
        if (completed) return;
        var committedPath = UpdateInstaller.MarkTransactionCommitted(statePath);
        completed = true;
        UpdateInstaller.TryDeleteDirectory(backupDirectory);
        UpdateInstaller.TryDeleteFile(statePath);
        if (!Directory.Exists(backupDirectory) || !File.Exists(statePath))
            UpdateInstaller.TryDeleteFile(committedPath);
    }

    public void Rollback()
    {
        if (completed) return;

        if (Directory.Exists(backupDirectory))
        {
            if (Directory.Exists(targetDirectory)) Directory.Delete(targetDirectory, recursive: true);
            Directory.Move(backupDirectory, targetDirectory);
        }

        completed = true;
        UpdateInstaller.TryDeleteFile(statePath);
        UpdateInstaller.TryDeleteFile(UpdateInstaller.GetCommittedMarkerPath(statePath));
    }

    public void Dispose() => Rollback();
}

public static class UpdateInstaller
{
    private const long MaxExpandedBytes = 1024L * 1024 * 1024;
    private const int MaxEntries = 20_000;
    private const string TransactionFileName = "pending-launcher-update.json";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static AppliedLauncherUpdate ApplyArchive(
        string archivePath,
        string targetDirectory,
        string expectedVersion,
        Action<string>? log = null
    )
    {
        archivePath = Path.GetFullPath(archivePath);
        targetDirectory = NormalizeTargetDirectory(targetDirectory);

        if (!File.Exists(archivePath))
            throw new FileNotFoundException("Пакет обновления не найден.", archivePath);
        if (!Directory.Exists(targetDirectory))
            throw new DirectoryNotFoundException("Папка установленного лаунчера не найдена.");

        var updateDirectory = Path.GetDirectoryName(archivePath)!;
        RecoverInterruptedUpdate(updateDirectory, targetDirectory, log);

        var parentDirectory = Path.GetDirectoryName(targetDirectory)!;
        var targetName = Path.GetFileName(targetDirectory);
        var updateId = Guid.NewGuid().ToString("N");
        var packageDirectory = Path.Combine(parentDirectory, $".{targetName}-package-{updateId}");
        var replacementDirectory = Path.Combine(parentDirectory, $".{targetName}-update-{updateId}");
        var backupDirectory = Path.Combine(parentDirectory, $".{targetName}-backup-{updateId}");
        var statePath = Path.Combine(updateDirectory, TransactionFileName);
        var stateWritten = false;

        try
        {
            log?.Invoke("Проверяем содержимое пакета обновления.");
            ExtractArchiveSafely(archivePath, packageDirectory);
            ValidatePackage(packageDirectory, expectedVersion);

            log?.Invoke("Подготавливаем новую версию лаунчера.");
            CopyDirectory(targetDirectory, replacementDirectory, overwrite: false);
            OverlayPackage(packageDirectory, replacementDirectory);

            WriteTransactionState(
                statePath,
                new UpdateTransactionState
                {
                    TransactionId = updateId,
                    TargetDirectory = targetDirectory,
                    BackupDirectory = backupDirectory,
                    ReplacementDirectory = replacementDirectory,
                }
            );
            stateWritten = true;

            log?.Invoke("Заменяем установленную версию.");
            Directory.Move(targetDirectory, backupDirectory);
            Directory.Move(replacementDirectory, targetDirectory);

            return new AppliedLauncherUpdate(targetDirectory, backupDirectory, statePath);
        }
        catch
        {
            if (stateWritten) RecoverInterruptedUpdate(updateDirectory, targetDirectory, log);
            throw;
        }
        finally
        {
            TryDeleteDirectory(packageDirectory);
            TryDeleteDirectory(replacementDirectory);
        }
    }

    public static void RecoverInterruptedUpdate(
        string updateDirectory,
        string expectedTargetDirectory,
        Action<string>? log = null
    )
    {
        var statePath = Path.Combine(Path.GetFullPath(updateDirectory), TransactionFileName);
        var committedPath = GetCommittedMarkerPath(statePath);
        if (!File.Exists(statePath))
        {
            TryDeleteFile(committedPath);
            return;
        }

        UpdateTransactionState state;
        try
        {
            state = JsonSerializer.Deserialize<UpdateTransactionState>(
                File.ReadAllText(statePath),
                JsonOptions
            ) ?? throw new InvalidOperationException("Состояние обновления повреждено.");
            ValidateTransactionState(state);
            if (!string.Equals(
                state.TargetDirectory,
                NormalizeTargetDirectory(expectedTargetDirectory),
                StringComparison.OrdinalIgnoreCase
            ))
            {
                throw new InvalidOperationException("Журнал относится к другой папке установки.");
            }
        }
        catch (Exception ex)
        {
            if (!TryRecoverFromKnownDirectories(expectedTargetDirectory, log))
                throw new InvalidOperationException(
                    "Журнал обновления повреждён и не может быть восстановлен автоматически.",
                    ex
                );

            TryDeleteFile(statePath);
            TryDeleteFile(committedPath);
            return;
        }

        var committedMarkerExists = File.Exists(committedPath);
        var committedTransactionId = ReadTextOrNull(committedPath)?.Trim();
        if (committedMarkerExists && committedTransactionId is null)
            throw new InvalidOperationException("Не удалось прочитать отметку завершения обновления.");
        if (string.Equals(
            committedTransactionId,
            state.TransactionId,
            StringComparison.Ordinal
        ))
        {
            log?.Invoke("Завершаем очистку после успешно установленного обновления.");
            if (!Directory.Exists(state.TargetDirectory)
                && Directory.Exists(state.BackupDirectory))
            {
                Directory.Move(state.BackupDirectory, state.TargetDirectory);
            }
            else
            {
                TryDeleteDirectory(state.BackupDirectory);
            }
            TryDeleteDirectory(state.ReplacementDirectory);
            TryDeleteFile(statePath);
            TryDeleteFile(committedPath);
            return;
        }
        if (committedTransactionId is not null) TryDeleteFile(committedPath);

        log?.Invoke("Восстанавливаем предыдущую версию после прерванного обновления.");
        if (Directory.Exists(state.BackupDirectory))
        {
            if (Directory.Exists(state.TargetDirectory))
                Directory.Delete(state.TargetDirectory, recursive: true);
            Directory.Move(state.BackupDirectory, state.TargetDirectory);
        }

        TryDeleteDirectory(state.ReplacementDirectory);
        TryDeleteFile(statePath);
    }

    public static bool HasPendingTransaction(string updateDirectory)
    {
        return File.Exists(Path.Combine(Path.GetFullPath(updateDirectory), TransactionFileName));
    }

    private static string NormalizeTargetDirectory(string path)
    {
        var fullPath = Path.GetFullPath(path)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var root = Path.GetPathRoot(fullPath)?.TrimEnd(
            Path.DirectorySeparatorChar,
            Path.AltDirectorySeparatorChar
        );
        if (string.IsNullOrWhiteSpace(fullPath)
            || string.Equals(fullPath, root, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Корневая папка диска не может быть целью обновления.");
        }

        return fullPath;
    }

    private static void ExtractArchiveSafely(string archivePath, string destinationDirectory)
    {
        Directory.CreateDirectory(destinationDirectory);
        var destinationRoot = Path.GetFullPath(destinationDirectory)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;

        using var archive = ZipFile.OpenRead(archivePath);
        if (archive.Entries.Count > MaxEntries)
            throw new InvalidOperationException("В пакете обновления слишком много файлов.");

        long expandedBytes = 0;
        var buffer = new byte[1024 * 128];
        foreach (var entry in archive.Entries)
        {
            var normalizedName = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
            var destinationPath = Path.GetFullPath(
                Path.Combine(destinationDirectory, normalizedName)
            );
            if (!destinationPath.StartsWith(destinationRoot, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Пакет обновления содержит небезопасный путь.");

            if (string.IsNullOrEmpty(entry.Name))
            {
                Directory.CreateDirectory(destinationPath);
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            using var input = entry.Open();
            using var output = new FileStream(
                destinationPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None
            );
            while (true)
            {
                var count = input.Read(buffer, 0, buffer.Length);
                if (count == 0) break;
                expandedBytes = checked(expandedBytes + count);
                if (expandedBytes > MaxExpandedBytes)
                    throw new InvalidOperationException(
                        "Распакованный пакет обновления слишком большой."
                    );
                output.Write(buffer, 0, count);
            }
        }
    }

    private static void ValidatePackage(string packageDirectory, string expectedVersion)
    {
        var manifestPath = Path.Combine(packageDirectory, "launcher-update.json");
        if (!File.Exists(manifestPath))
            throw new InvalidOperationException("В пакете отсутствует описание обновления.");

        var manifest = JsonSerializer.Deserialize<LauncherPackageManifest>(
            File.ReadAllText(manifestPath),
            JsonOptions
        ) ?? throw new InvalidOperationException("Описание обновления повреждено.");

        if (!TryNormalizeVersion(expectedVersion, out var expected)
            || !TryNormalizeVersion(manifest.LauncherVersion, out var packaged)
            || expected != packaged)
        {
            throw new InvalidOperationException(
                "Версия загруженного пакета не совпадает с версией из манифеста."
            );
        }

        var launcherPath = Path.Combine(packageDirectory, "cs2haze.exe");
        if (!string.Equals(manifest.EntryPoint, "cs2haze.exe", StringComparison.OrdinalIgnoreCase)
            || !File.Exists(launcherPath))
        {
            throw new InvalidOperationException("В пакете отсутствует cs2haze.exe.");
        }

        var versionInfo = FileVersionInfo.GetVersionInfo(launcherPath);
        var executableVersion = new Version(
            versionInfo.FileMajorPart,
            versionInfo.FileMinorPart,
            versionInfo.FileBuildPart,
            versionInfo.FilePrivatePart
        );
        if (executableVersion != expected)
            throw new InvalidOperationException(
                "Фактическая версия cs2haze.exe не совпадает с версией обновления."
            );

        if (!File.Exists(Path.Combine(packageDirectory, "cs2haze-updater.exe")))
            throw new InvalidOperationException("В пакете отсутствует модуль обновления.");
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

    private static void OverlayPackage(string sourceDirectory, string destinationDirectory)
    {
        foreach (var sourcePath in Directory.EnumerateFiles(
            sourceDirectory,
            "*",
            SearchOption.AllDirectories
        ))
        {
            var relativePath = Path.GetRelativePath(sourceDirectory, sourcePath);
            if (string.Equals(relativePath, "launcher-update.json", StringComparison.OrdinalIgnoreCase)
                || string.Equals(relativePath, "launcher-config.json", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var destinationPath = Path.Combine(destinationDirectory, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            File.Copy(sourcePath, destinationPath, overwrite: true);
        }
    }

    private static void CopyDirectory(
        string sourceDirectory,
        string destinationDirectory,
        bool overwrite
    )
    {
        Directory.CreateDirectory(destinationDirectory);

        foreach (var directory in Directory.EnumerateDirectories(
            sourceDirectory,
            "*",
            SearchOption.AllDirectories
        ))
        {
            if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException(
                    "Папка установки содержит ссылку, которую нельзя безопасно обновить."
                );
            Directory.CreateDirectory(Path.Combine(
                destinationDirectory,
                Path.GetRelativePath(sourceDirectory, directory)
            ));
        }

        foreach (var file in Directory.EnumerateFiles(
            sourceDirectory,
            "*",
            SearchOption.AllDirectories
        ))
        {
            if ((File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException(
                    "Папка установки содержит ссылку, которую нельзя безопасно обновить."
                );
            var destination = Path.Combine(
                destinationDirectory,
                Path.GetRelativePath(sourceDirectory, file)
            );
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination, overwrite);
        }
    }

    private static void WriteTransactionState(string statePath, UpdateTransactionState state)
    {
        var committedPath = GetCommittedMarkerPath(statePath);
        if (File.Exists(committedPath)) File.Delete(committedPath);
        WriteDurableText(statePath, JsonSerializer.Serialize(state, JsonOptions));
    }

    internal static string MarkTransactionCommitted(string statePath)
    {
        var state = JsonSerializer.Deserialize<UpdateTransactionState>(
            File.ReadAllText(statePath),
            JsonOptions
        ) ?? throw new InvalidOperationException("Состояние обновления повреждено.");
        ValidateTransactionState(state);
        var committedPath = GetCommittedMarkerPath(statePath);
        WriteDurableText(committedPath, state.TransactionId);
        return committedPath;
    }

    internal static string GetCommittedMarkerPath(string statePath) => statePath + ".committed";

    private static void ValidateTransactionState(UpdateTransactionState state)
    {
        if (!Guid.TryParseExact(state.TransactionId, "N", out _))
            throw new InvalidOperationException("Состояние обновления не содержит ID транзакции.");
        state.TargetDirectory = NormalizeTargetDirectory(state.TargetDirectory);
        state.BackupDirectory = Path.GetFullPath(state.BackupDirectory);
        state.ReplacementDirectory = Path.GetFullPath(state.ReplacementDirectory);

        var parent = Path.GetDirectoryName(state.TargetDirectory)!;
        var targetName = Path.GetFileName(state.TargetDirectory);
        if (!string.Equals(Path.GetDirectoryName(state.BackupDirectory), parent, StringComparison.OrdinalIgnoreCase)
            || !Path.GetFileName(state.BackupDirectory).StartsWith($".{targetName}-backup-", StringComparison.OrdinalIgnoreCase)
            || !string.Equals(Path.GetDirectoryName(state.ReplacementDirectory), parent, StringComparison.OrdinalIgnoreCase)
            || !Path.GetFileName(state.ReplacementDirectory).StartsWith($".{targetName}-update-", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Состояние обновления содержит небезопасные пути.");
        }
    }

    private static void WriteDurableText(string path, string value)
    {
        var bytes = new UTF8Encoding(false).GetBytes(value);
        using (var stream = new FileStream(
            path,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            4096,
            FileOptions.WriteThrough
        ))
        {
            stream.Write(bytes);
            stream.Flush(flushToDisk: true);
        }
    }

    private static string? ReadTextOrNull(string path)
    {
        try
        {
            return File.Exists(path) ? File.ReadAllText(path) : null;
        }
        catch
        {
            return null;
        }
    }

    private static bool TryRecoverFromKnownDirectories(
        string expectedTargetDirectory,
        Action<string>? log
    )
    {
        var targetDirectory = NormalizeTargetDirectory(expectedTargetDirectory);
        var parent = Path.GetDirectoryName(targetDirectory)!;
        var targetName = Path.GetFileName(targetDirectory);
        var backups = Directory.GetDirectories(parent, $".{targetName}-backup-*");
        var replacements = Directory.GetDirectories(parent, $".{targetName}-update-*");
        if (backups.Length > 1 || replacements.Length > 1) return false;

        log?.Invoke("Восстанавливаем установку по сохранённым резервным папкам.");
        if (backups.Length == 1)
        {
            if (Directory.Exists(targetDirectory))
                Directory.Delete(targetDirectory, recursive: true);
            Directory.Move(backups[0], targetDirectory);
        }
        else if (!Directory.Exists(targetDirectory))
        {
            if (replacements.Length != 1) return false;
            Directory.Move(replacements[0], targetDirectory);
            replacements = [];
        }

        foreach (var replacement in replacements) TryDeleteDirectory(replacement);
        return Directory.Exists(targetDirectory);
    }

    internal static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path)) Directory.Delete(path, recursive: true);
        }
        catch { }
    }

    internal static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch { }
    }

    private sealed class LauncherPackageManifest
    {
        public string LauncherVersion { get; set; } = "";
        public string EntryPoint { get; set; } = "";
    }

    private sealed class UpdateTransactionState
    {
        public string TransactionId { get; set; } = "";
        public string TargetDirectory { get; set; } = "";
        public string BackupDirectory { get; set; } = "";
        public string ReplacementDirectory { get; set; } = "";
    }
}
