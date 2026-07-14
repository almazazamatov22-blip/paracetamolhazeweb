using System.Diagnostics;

namespace CS2Haze.Launcher;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        var tokenArg = args.FirstOrDefault(a => a.StartsWith("cs2haze://connect?token="));
        if (tokenArg != null)
        {
            var token = tokenArg.Substring("cs2haze://connect?token=".Length);
            var tokenPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "cs2haze", "pending-connect-token.txt");
            Directory.CreateDirectory(Path.GetDirectoryName(tokenPath)!);
            File.WriteAllText(tokenPath, token);
        }

        using var mutex = new Mutex(true, @"Local\cs2haze-launcher", out var createdNew);
        if (!createdNew)
        {
            if (tokenArg != null)
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
