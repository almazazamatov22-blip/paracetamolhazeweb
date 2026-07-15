using System;
using System.Diagnostics;
using System.Text;
using System.Threading.Tasks;

namespace CS2Haze.Utf8Smoke
{
    class Program
    {
        static async Task Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "child")
            {
                // Child process writes UTF8 text
                Console.OutputEncoding = Encoding.UTF8;
                Console.WriteLine("Запуск действия");
                Console.Error.WriteLine("Ошибка выполнения");
                return;
            }

            var expectedOutput = "Запуск действия";
            var expectedError = "Ошибка выполнения";

            var receivedOutput = string.Empty;
            var receivedError = string.Empty;

            var processPath = Environment.ProcessPath;
            if (processPath == null) throw new Exception("ProcessPath is null");

            var info = new ProcessStartInfo
            {
                FileName = processPath,
                Arguments = "child",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };

            using var process = new Process { StartInfo = info, EnableRaisingEvents = true };

            var tcs = new TaskCompletionSource<bool>();

            process.OutputDataReceived += (s, e) => 
            {
                if (!string.IsNullOrEmpty(e.Data)) receivedOutput = e.Data;
            };

            process.ErrorDataReceived += (s, e) => 
            {
                if (!string.IsNullOrEmpty(e.Data)) receivedError = e.Data;
            };

            process.Exited += (s, e) => tcs.TrySetResult(true);

            if (!process.Start())
                throw new Exception("Failed to start child process.");

            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await tcs.Task;
            process.WaitForExit();

            if (receivedOutput != expectedOutput)
            {
                Console.WriteLine($"[FAIL] Output mismatch. Expected: '{expectedOutput}', Got: '{receivedOutput}'");
                Environment.Exit(1);
            }

            if (receivedError != expectedError)
            {
                Console.WriteLine($"[FAIL] Error mismatch. Expected: '{expectedError}', Got: '{receivedError}'");
                Environment.Exit(1);
            }

            Console.WriteLine("[PASS] UTF-8 Stdout/Stderr correctly handled.");
            Environment.Exit(0);
        }
    }
}
