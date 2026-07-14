using System.Diagnostics;
using System.IO;

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
            var logEntry = $"{timestamp} protocol received\nscheme=cs2haze\ntarget={hostOrPath}\ntokenPresent={tokenPresent}\ntokenLength={tokenLength}\nprimaryInstance={isPrimary}\n\n";
            File.AppendAllText(logPath, logEntry);
        }
        catch { }
    }

    private static string? ExtractConnectToken(string[] args)
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
                                        return Uri.UnescapeDataString(pair.Substring(eq + 1));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        var connectToken = ExtractConnectToken(args);

        if (!string.IsNullOrWhiteSpace(connectToken))
        {
            var tokenPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "cs2haze", "pending-connect-token.txt");
            Directory.CreateDirectory(Path.GetDirectoryName(tokenPath)!);
            File.WriteAllText(tokenPath, connectToken);
        }

        using var mutex = new Mutex(true, @"Local\cs2haze-launcher", out var createdNew);
        
        if (!string.IsNullOrWhiteSpace(connectToken))
        {
            LogProtocolActivity(args.Length, true, "connect", true, connectToken.Length, createdNew);
        }
        else if (args.Length > 0 && args[0].Trim(' ', '"', '\'').StartsWith("cs2haze:", StringComparison.OrdinalIgnoreCase))
        {
            LogProtocolActivity(args.Length, true, "unknown", false, 0, createdNew);
        }
        
        if (!createdNew)
        {
            if (!string.IsNullOrWhiteSpace(connectToken))
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

        Application.Run(new MainForm());
    }
}
