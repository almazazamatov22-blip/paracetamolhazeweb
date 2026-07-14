using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using CS2Haze.Launcher.Models;
using CS2Haze.Launcher.Services;

namespace CS2Haze.Launcher;

public sealed class MainForm : Form
{
    private readonly Label title = new();
    private readonly Label subtitle = new();
    private readonly Label status = new();
    private readonly Label detail = new();
    private readonly ProgressBar progress = new();
    private readonly Button openLogs = new();
    private readonly Button exit = new();
    private readonly NotifyIcon tray = new();

    private readonly StorageService storage = new();
    private readonly HttpClient http = new() { Timeout = TimeSpan.FromMinutes(5) };
    private readonly CancellationTokenSource cancellation = new();
    private readonly AgentService agent;
    private LauncherConfig config = new();
    private LocalState state = new();

    public MainForm()
    {
        agent = new AgentService(storage);

        Text = "cs2haze";
        ClientSize = new Size(620, 320);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        BackColor = Color.FromArgb(8, 10, 11);
        ForeColor = Color.White;
        StartPosition = FormStartPosition.CenterScreen;
        Icon = LoadIcon();

        title.Text = "cs2haze";
        title.Font = new Font("Segoe UI", 30, FontStyle.Bold);
        title.ForeColor = Color.White;
        title.Location = new Point(34, 26);
        title.AutoSize = true;

        subtitle.Text = "CS2 INTERACTIVE LAUNCHER";
        subtitle.Font = new Font("Segoe UI Semibold", 10, FontStyle.Bold);
        subtitle.ForeColor = Color.FromArgb(30, 215, 96);
        subtitle.Location = new Point(38, 82);
        subtitle.AutoSize = true;

        status.Text = "Подготовка…";
        status.Font = new Font("Segoe UI Semibold", 16, FontStyle.Bold);
        status.Location = new Point(38, 135);
        status.AutoSize = true;

        detail.Text = "Проверяем файлы и соединение.";
        detail.Font = new Font("Segoe UI", 10);
        detail.ForeColor = Color.FromArgb(170, 178, 175);
        detail.Location = new Point(40, 176);
        detail.MaximumSize = new Size(530, 50);
        detail.AutoSize = true;

        progress.Location = new Point(40, 222);
        progress.Size = new Size(540, 8);
        progress.Style = ProgressBarStyle.Marquee;
        progress.MarqueeAnimationSpeed = 28;

        openLogs.Text = "Открыть логи";
        openLogs.Location = new Point(40, 258);
        openLogs.Size = new Size(125, 34);
        openLogs.FlatStyle = FlatStyle.Flat;
        openLogs.FlatAppearance.BorderColor = Color.FromArgb(55, 62, 59);
        openLogs.ForeColor = Color.White;
        openLogs.Click += (_, _) => Process.Start(new ProcessStartInfo
        {
            FileName = storage.LogsDirectory,
            UseShellExecute = true,
        });

        exit.Text = "Выход";
        exit.Location = new Point(475, 258);
        exit.Size = new Size(105, 34);
        exit.FlatStyle = FlatStyle.Flat;
        exit.FlatAppearance.BorderColor = Color.FromArgb(55, 62, 59);
        exit.ForeColor = Color.White;
        exit.Click += (_, _) => Close();

        Controls.AddRange([title, subtitle, status, detail, progress, openLogs, exit]);

        tray.Icon = Icon;
        tray.Text = "cs2haze";
        tray.Visible = false;
        tray.DoubleClick += (_, _) =>
        {
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        };
        tray.ContextMenuStrip = new ContextMenuStrip();
        tray.ContextMenuStrip.Items.Add("Открыть", null, (_, _) => ShowFromTray());
        tray.ContextMenuStrip.Items.Add("Открыть логи", null, (_, _) =>
            Process.Start(new ProcessStartInfo
            {
                FileName = storage.LogsDirectory,
                UseShellExecute = true,
            })
        );
        tray.ContextMenuStrip.Items.Add("Выход", null, (_, _) => Close());

        Shown += async (_, _) => await StartAsync();
        FormClosing += (_, _) =>
        {
            cancellation.Cancel();
            agent.Dispose();
            tray.Visible = false;
            http.Dispose();
        };
        Resize += (_, _) =>
        {
            if (WindowState == FormWindowState.Minimized)
            {
                Hide();
                tray.Visible = true;
            }
        };
    }

    private async Task StartAsync()
    {
        try
        {
            config = LoadConfig();
            state = storage.LoadState();
            var installDirectory = AppContext.BaseDirectory;
            var launcherVersion =
                Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

            SetState("Проверка обновлений…", "Подключаемся к серверу.", marquee: true);

            var updateService = new UpdateService(http, config);
            var manifest = await updateService.GetManifestAsync(
                launcherVersion,
                state.RuntimeVersion,
                cancellation.Token
            );

            config.RequireAuthentication =
                config.RequireAuthentication || manifest.RequireAuthentication;
            config.RequireSubscription =
                config.RequireSubscription || manifest.RequireSubscription;

            if (!string.IsNullOrWhiteSpace(manifest.RuntimeUrl)
                && !string.Equals(
                    state.RuntimeVersion,
                    manifest.RuntimeVersion,
                    StringComparison.OrdinalIgnoreCase
                ))
            {
                SetState(
                    "Установка обновления…",
                    $"Версия runtime: {manifest.RuntimeVersion}",
                    marquee: false
                );
                var reporter = new Progress<int>(value => progress.Value = value);
                await updateService.InstallRuntimeAsync(
                    manifest,
                    installDirectory,
                    reporter,
                    cancellation.Token
                );
                state.RuntimeVersion = manifest.RuntimeVersion;
                storage.SaveState(state);
            }

            LauncherSession? session = null;
            var authService = new AuthService(http, config, storage);

            if (config.RequireAuthentication)
            {
                SetState("Проверка входа…", "Используем существующий аккаунт сайта.", true);
                session = await authService.TryRestoreSessionAsync(state, cancellation.Token);

                if (session is null)
                {
                    session = await authService.LoginThroughExistingWebsiteAsync(
                        message => BeginInvoke(() => SetState("Вход через сайт", message, true)),
                        cancellation.Token
                    );
                }

                if (!session.Access)
                    throw new InvalidOperationException("Доступ к cs2haze не разрешён.");

                if (config.RequireSubscription && !session.SubscriptionActive)
                    throw new InvalidOperationException(
                        "Подписка неактивна. Оформите её на сайте и запустите cs2haze снова."
                    );

                if (!string.IsNullOrWhiteSpace(session.RefreshToken))
                    state.ProtectedRefreshToken = storage.Protect(session.RefreshToken);
                state.StreamerId = session.StreamerId ?? state.StreamerId;
                state.DisplayName = session.DisplayName ?? state.DisplayName;
                storage.SaveState(state);
            }

            if (string.IsNullOrWhiteSpace(state.StreamerId))
                throw new InvalidOperationException(
                    "Не найден streamer ID. Подключите Twitch-аккаунт на сайте."
                );

            SetState(
                "Запуск агента…",
                state.DisplayName is null
                    ? "Подключаем CS2 Interactive."
                    : $"Аккаунт: {state.DisplayName}",
                true
            );

            agent.Start(
                installDirectory,
                state.StreamerId,
                config.AgentBaseUrl,
                line => BeginInvoke(() => detail.Text = line)
            );

            SetState("cs2haze запущен", "Агент работает. Окно можно свернуть.", false);
            progress.Value = 100;

            await Task.Delay(900, cancellation.Token);
            WindowState = FormWindowState.Minimized;
        }
        catch (OperationCanceledException)
        {
        }
        catch (Exception ex)
        {
            SetState("Не удалось запустить", ex.Message, false);
            progress.Value = 0;
            MessageBox.Show(ex.Message, "cs2haze", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private LauncherConfig LoadConfig()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "launcher-config.json");
        if (!File.Exists(path))
        {
            var defaults = new LauncherConfig();
            File.WriteAllText(
                path,
                JsonSerializer.Serialize(defaults, new JsonSerializerOptions { WriteIndented = true })
            );
            return defaults;
        }

        return JsonSerializer.Deserialize<LauncherConfig>(File.ReadAllText(path))
            ?? new LauncherConfig();
    }

    private void SetState(string heading, string message, bool marquee)
    {
        status.Text = heading;
        detail.Text = message;
        progress.Style = marquee ? ProgressBarStyle.Marquee : ProgressBarStyle.Continuous;
        progress.MarqueeAnimationSpeed = marquee ? 28 : 0;
        if (!marquee && progress.Value == 0) progress.Value = 10;
    }

    private void ShowFromTray()
    {
        tray.Visible = false;
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
    }

    private static Icon? LoadIcon()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Assets", "cs2haze.ico");
        return File.Exists(path) ? new Icon(path) : null;
    }
}
