using System.Diagnostics;
using System.IO.Compression;
using System.Windows.Forms;

namespace CS2Haze.Updater;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            var map = args
                .Select(arg => arg.Split('=', 2))
                .Where(parts => parts.Length == 2)
                .ToDictionary(parts => parts[0].TrimStart('-'), parts => parts[1]);

            var pid = int.Parse(map["pid"]);
            var archive = Path.GetFullPath(map["archive"]);
            var targetDirectory = Path.GetFullPath(map["target"]);
            var launcherPath = Path.Combine(targetDirectory, "cs2haze.exe");

            try
            {
                Process.GetProcessById(pid).WaitForExit(15_000);
            }
            catch { }

            var temp = Path.Combine(Path.GetTempPath(), "cs2haze-self-update-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);
            ZipFile.ExtractToDirectory(archive, temp);

            foreach (var source in Directory.EnumerateFiles(temp, "*", SearchOption.AllDirectories))
            {
                var relative = Path.GetRelativePath(temp, source);
                var destination = Path.Combine(targetDirectory, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                File.Copy(source, destination, overwrite: true);
            }

            Directory.Delete(temp, true);
            File.Delete(archive);

            Process.Start(new ProcessStartInfo
            {
                FileName = launcherPath,
                UseShellExecute = true,
            });

            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "cs2haze updater", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
