using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using CS2Haze.Launcher.Services;

namespace CS2Haze.Launcher;

internal static class Program
{
    private static void LogProtocolActivity(int argCount, bool hasScheme, string hostOrPath, bool tokenPresent, int tokenLength, bool isPrimary)
    {
        try
        {
            var logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "cs2haze", "logs", "protocol.log");
            Directory.CreateDirectory(Path.GetDirectoryName(logPath)!);
            var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var logEntry =
                $"{timestamp} Получена команда от браузера.\n"
                + "Протокол: cs2haze\n"
                + $"Назначение: {hostOrPath}\n"
                + $"Токен получен: {(tokenPresent ? "да" : "нет")}\n"
                + $"Длина токена: {tokenLength}\n"
                + $"Основной процесс: {(isPrimary ? "да" : "нет")}\n\n";
            File.AppendAllText(logPath, logEntry, new UTF8Encoding(false));
        }
        catch { }
    }

    private static (string? token, string? origin) ExtractConnectToken(string[] args)
    {
        foreach (var arg in args)
        {
            var cleanArg = arg.Trim(' ', '"', '\'');
            if (cleanArg.StartsWith("cs2haze:", StringComparison.OrdinalIgnoreCase))
            {
                if (Uri.TryCreate(cleanArg, UriKind.Absolute, out var uri))
                {
                    if (string.Equals(uri.Scheme, "cs2haze", StringComparison.OrdinalIgnoreCase))
                    {
                        var target = uri.Host;
                        if (string.IsNullOrEmpty(target)) target = uri.AbsolutePath.Trim('/');
                        
                        if (string.Equals(target, "connect", StringComparison.OrdinalIgnoreCase))
                        {
                            string? token = null;
                            string? origin = null;
                            var query = uri.Query.TrimStart('?');
                            var pairs = query.Split('&');
                            foreach (var pair in pairs)
                            {
                                var eq = pair.IndexOf('=');
                                if (eq > 0)
                                {
                                    var key = pair.Substring(0, eq);
                                    if (string.Equals(key, "token", StringComparison.OrdinalIgnoreCase))
                                    {
                                        token = Uri.UnescapeDataString(pair.Substring(eq + 1));
                                    }
                                    else if (string.Equals(key, "origin", StringComparison.OrdinalIgnoreCase))
                                    {
                                        origin = Uri.UnescapeDataString(pair.Substring(eq + 1));
                                    }
                                }
                            }

                            if (!string.IsNullOrEmpty(origin))
                            {
                                origin = ValidateAndNormalizeOrigin(origin);
                                if (origin == null)
                                {
                                    // If an origin is provided but invalid, we reject the request.
                                    return (null, null);
                                }
                            }

                            if (!string.IsNullOrEmpty(token))
                            {
                                return (token, origin);
                            }
                        }
                    }
                }
            }
        }
        return (null, null);
    }

    private static string? ValidateAndNormalizeOrigin(string originRaw)
    {
        if (!Uri.TryCreate(originRaw, UriKind.Absolute, out var uri))
            return null;

        if (!string.Equals(uri.Scheme, "https", StringComparison.OrdinalIgnoreCase))
            return null;

        if (!string.IsNullOrEmpty(uri.UserInfo))
            return null;

        var normalized = uri.GetComponents(UriComponents.SchemeAndServer, UriFormat.Unescaped);

        var allowlist = new[]
        {
            "https://paracetamolhaze.ru",
            "https://paracetamolhaze.online",
            "https://paracetamolhaze-six.vercel.app"
        };

        foreach (var allowed in allowlist)
        {
            if (string.Equals(normalized, allowed, StringComparison.OrdinalIgnoreCase))
            {
                return normalized;
            }
        }

        return null;
    }

    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        var extracted = ExtractConnectToken(args);

        if (!string.IsNullOrWhiteSpace(extracted.token))
        {
            new PendingConnectTokenStore().Write(extracted.token, extracted.origin);
        }

        using var mutex = new Mutex(
            true,
            PendingConnectTokenStore.LauncherMutexName,
            out var createdNew
        );
        
        if (!string.IsNullOrWhiteSpace(extracted.token))
        {
            LogProtocolActivity(args.Length, true, "connect", true, extracted.token.Length, createdNew);
        }
        else if (args.Length > 0 && args[0].Trim(' ', '"', '\'').StartsWith("cs2haze:", StringComparison.OrdinalIgnoreCase))
        {
            LogProtocolActivity(args.Length, true, "unknown", false, 0, createdNew);
        }
        
        if (!createdNew)
        {
            if (!string.IsNullOrWhiteSpace(extracted.token))
            {
                return;
            }

            MessageBox.Show(
                "cs2haze уже запущен.",
                "cs2haze",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
            return;
        }

        var mainForm = new MainForm();
        mainForm.Shown += (_, _) =>
        {
            SignalSuccessfulUpdate(args);
            _ = Task.Run(() => CleanupTemporaryUpdater(args));
        };
        Application.Run(mainForm);
    }

    private static void CleanupTemporaryUpdater(string[] args)
    {
        const string prefix = "--cleanup-updater=";
        var path = args
            .FirstOrDefault(arg => arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            ?[prefix.Length..]
            .Trim(' ', '"', '\'');

        if (!IsSafeUpdateFile(path, "updater-", ".exe")) return;

        for (var attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                if (!File.Exists(path)) return;
                File.Delete(path);
                return;
            }
            catch (IOException)
            {
                Thread.Sleep(250);
            }
            catch (UnauthorizedAccessException)
            {
                return;
            }
        }
    }

    private static void SignalSuccessfulUpdate(string[] args)
    {
        var readyPath = GetArgumentValue(args, "--update-ready=");
        var expectedVersion = GetArgumentValue(args, "--update-version=");
        if (!IsSafeUpdateFile(readyPath, "ready-", ".txt")
            || !Version.TryParse(expectedVersion, out var expected))
        {
            return;
        }

        var current = Assembly.GetExecutingAssembly().GetName().Version;
        if (current is null
            || NormalizeVersion(current) != NormalizeVersion(expected))
        {
            return;
        }

        File.WriteAllText(readyPath!, expectedVersion!, new UTF8Encoding(false));
    }

    private static string? GetArgumentValue(string[] args, string prefix)
    {
        return args
            .FirstOrDefault(arg => arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            ?[prefix.Length..]
            .Trim(' ', '"', '\'');
    }

    private static bool IsSafeUpdateFile(string? path, string prefix, string extension)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        try
        {
            var updatesDirectory = Path.GetFullPath(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "cs2haze",
                "updates"
            )).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
            var fullPath = Path.GetFullPath(path);
            var fileName = Path.GetFileName(fullPath);
            return fullPath.StartsWith(updatesDirectory, StringComparison.OrdinalIgnoreCase)
                && fileName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                && fileName.EndsWith(extension, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static Version NormalizeVersion(Version version)
    {
        return new Version(
            version.Major,
            version.Minor,
            Math.Max(version.Build, 0),
            Math.Max(version.Revision, 0)
        );
    }
}
