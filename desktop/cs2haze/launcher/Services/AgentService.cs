using System.Diagnostics;
using System.Text;

namespace CS2Haze.Launcher.Services;

public sealed class AgentService(StorageService storage) : IDisposable
{
    private Process? process;
    private StreamWriter? logWriter;

    public bool IsRunning => process is { HasExited: false };

    public void Start(
        string installDirectory,
        string streamerId,
        string agentBaseUrl,
        Action<string> onLine
    )
    {
        if (IsRunning) return;

        var runtime = Path.Combine(installDirectory, "runtime");
        var nodePath = Path.Combine(runtime, "node.exe");
        var agentPath = Path.Combine(runtime, "cs2-agent.js");

        if (!File.Exists(nodePath))
            throw new FileNotFoundException("Не найден встроенный node.exe.", nodePath);
        if (!File.Exists(agentPath))
            throw new FileNotFoundException("Не найден cs2-agent.js.", agentPath);

        var logPath = Path.Combine(
            storage.LogsDirectory,
            $"agent-{DateTime.Now:yyyy-MM-dd}.log"
        );
        logWriter = new StreamWriter(logPath, append: true, Encoding.UTF8) { AutoFlush = true };

        var info = new ProcessStartInfo
        {
            FileName = nodePath,
            WorkingDirectory = runtime,
            Arguments = $"\"{agentPath}\" --streamerId={streamerId}",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        info.Environment["CS2_BASE_URL"] = agentBaseUrl;
        info.Environment["CS2_STREAMER_ID"] = streamerId;

        process = new Process { StartInfo = info, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, e) => WriteLine(e.Data, onLine);
        process.ErrorDataReceived += (_, e) => WriteLine(e.Data, onLine);
        process.Exited += (_, _) => WriteLine("Агент остановлен.", onLine);

        if (!process.Start())
            throw new InvalidOperationException("Не удалось запустить агент.");

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
    }

    public void Stop()
    {
        try
        {
            if (process is { HasExited: false })
            {
                process.CloseMainWindow();
                if (!process.WaitForExit(1500)) process.Kill(entireProcessTree: true);
            }
        }
        catch { }
        finally
        {
            process?.Dispose();
            process = null;
            logWriter?.Dispose();
            logWriter = null;
        }
    }

    private void WriteLine(string? line, Action<string> onLine)
    {
        if (string.IsNullOrWhiteSpace(line)) return;
        logWriter?.WriteLine($"[{DateTime.Now:HH:mm:ss}] {line}");
        onLine(line);
    }

    public void Dispose() => Stop();
}
