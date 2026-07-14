using System.Security.Principal;

namespace CS2Haze.Launcher.Services;

public sealed class PendingConnectTokenStore
{
    private static readonly string CurrentUserSid =
        WindowsIdentity.GetCurrent().User?.Value
        ?? throw new InvalidOperationException("Unable to resolve the current Windows user SID.");
    private static readonly string MutexName =
        $@"Global\cs2haze-connect-token-{CurrentUserSid}";
    private static readonly TimeSpan LockTimeout = TimeSpan.FromSeconds(5);

    public static string LauncherMutexName { get; } =
        $@"Global\cs2haze-launcher-{CurrentUserSid}";

    public string TokenPath { get; }

    public PendingConnectTokenStore(string? dataDirectory = null)
    {
        dataDirectory ??= Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "cs2haze"
        );
        Directory.CreateDirectory(dataDirectory);
        TokenPath = Path.Combine(dataDirectory, "pending-connect-token.txt");
    }

    public void Write(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("Connect token is empty.", nameof(token));

        WithLock(() =>
        {
            var tempPath = $"{TokenPath}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
            try
            {
                File.WriteAllText(tempPath, token);
                for (var attempt = 1; ; attempt++)
                {
                    try
                    {
                        File.Move(tempPath, TokenPath, overwrite: true);
                        break;
                    }
                    catch (IOException) when (attempt < 10)
                    {
                        Thread.Sleep(50);
                    }
                }
            }
            finally
            {
                try
                {
                    if (File.Exists(tempPath)) File.Delete(tempPath);
                }
                catch { }
            }
        });
    }

    public string? Read()
    {
        return WithLock(() =>
        {
            if (!File.Exists(TokenPath)) return null;
            try
            {
                return File.ReadAllText(TokenPath);
            }
            catch (IOException)
            {
                return null;
            }
            catch (UnauthorizedAccessException)
            {
                return null;
            }
        });
    }

    public void DeleteIfMatches(string token)
    {
        WithLock(() =>
        {
            try
            {
                if (File.Exists(TokenPath)
                    && string.Equals(
                        File.ReadAllText(TokenPath),
                        token,
                        StringComparison.Ordinal
                    ))
                {
                    File.Delete(TokenPath);
                }
            }
            catch (IOException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
        });
    }

    private static T WithLock<T>(Func<T> action)
    {
        using var mutex = new Mutex(initiallyOwned: false, MutexName);
        var acquired = false;

        try
        {
            try
            {
                acquired = mutex.WaitOne(LockTimeout);
            }
            catch (AbandonedMutexException)
            {
                acquired = true;
            }

            if (!acquired)
                throw new TimeoutException("Timed out waiting for the protocol token lock.");

            return action();
        }
        finally
        {
            if (acquired) mutex.ReleaseMutex();
        }
    }

    private static void WithLock(Action action)
    {
        WithLock(() =>
        {
            action();
            return true;
        });
    }
}
