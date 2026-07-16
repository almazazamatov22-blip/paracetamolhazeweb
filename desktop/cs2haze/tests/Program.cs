using CS2Haze.Launcher.Services;

var testDirectory = Path.Combine(
    Path.GetTempPath(),
    "cs2haze-token-store-smoke-" + Guid.NewGuid().ToString("N")
);

try
{
    var primary = new PendingConnectTokenStore(testDirectory);
    var secondary = new PendingConnectTokenStore(testDirectory);

    primary.Write("token-a", "origin-a");
    var observed = primary.Read();
    if (observed?.Token != "token-a")
        throw new InvalidOperationException("Initial token was not readable.");

    secondary.Write("token-b", "origin-b");
    if (observed?.Token != null)
        primary.DeleteIfMatches(observed.Token);
    if (primary.Read()?.Token != "token-b")
        throw new InvalidOperationException("An older claim deleted a newer callback token.");

    primary.DeleteIfMatches("token-b");
    if (primary.Read() is not null)
        throw new InvalidOperationException("Claimed token was not deleted.");

    Parallel.For(0, 32, index =>
    {
        new PendingConnectTokenStore(testDirectory).Write($"parallel-{index}", $"origin-{index}");
    });

    var finalToken = primary.Read();
    if (finalToken is null || !finalToken.Token.StartsWith("parallel-"))
        throw new InvalidOperationException("Parallel handoff left an invalid token file.");

    Console.WriteLine("cs2haze token-store smoke passed.");
}
finally
{
    try
    {
        if (Directory.Exists(testDirectory)) Directory.Delete(testDirectory, recursive: true);
    }
    catch { }
}
