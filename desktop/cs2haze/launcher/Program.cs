using System.Diagnostics;

namespace CS2Haze.Launcher;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        using var mutex = new Mutex(true, @"Local\cs2haze-launcher", out var createdNew);
        if (!createdNew)
        {
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
