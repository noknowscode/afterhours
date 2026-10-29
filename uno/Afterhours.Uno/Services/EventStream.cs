using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace Afterhours.Uno.Services;

// One-off events (unlike Latest<T>, nothing is replayed): each watcher sees what is published while it watches.
public sealed class EventStream<T>
{
    private readonly List<Channel<T>> _watchers = [];

    public void Publish(T value)
    {
        foreach (var watcher in _watchers.ToArray())
            watcher.Writer.TryWrite(value);
    }

    public async IAsyncEnumerable<T> Watch([EnumeratorCancellation] CancellationToken ct = default)
    {
        var channel = Channel.CreateUnbounded<T>();
        _watchers.Add(channel);
        try
        {
            await foreach (var value in channel.Reader.ReadAllAsync(ct))
                yield return value;
        }
        finally
        {
            _watchers.Remove(channel);
        }
    }
}
