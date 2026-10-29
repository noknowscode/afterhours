using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class LatestTests
{
    private sealed record Box(int N);

    [Fact]
    public async Task A_watcher_gets_the_current_value_then_each_new_one()
    {
        var latest = new Latest<Box>();
        latest.Set(new Box(1));
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var seen = new List<int>();
        // Latest keeps only the newest value, so each Set waits until the watcher has taken the previous one.
        var took = new SemaphoreSlim(0);
        var watching = Task.Run(async () =>
        {
            await foreach (var box in latest.Watch(cts.Token))
            {
                seen.Add(box.N);
                took.Release();
                if (box.N == 3)
                    break;
            }
        });
        await took.WaitAsync(cts.Token);
        latest.Set(new Box(2));
        await took.WaitAsync(cts.Token);
        latest.Set(new Box(3));
        await watching;
        Assert.Equal([1, 2, 3], seen);
    }

    [Fact]
    public async Task Watching_stops_when_cancelled()
    {
        var latest = new Latest<Box>();
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () => { await foreach (var _ in latest.Watch(cts.Token)) { } });
    }
}
