using System.Runtime.CompilerServices;

namespace Afterhours.Uno.Services;

// Holds the newest value of a pushed stream. Each watcher gets the current value, then every later one.
public sealed class Latest<T> where T : class
{
    private T? _value;
    private Exception? _error;
    private TaskCompletionSource _changed = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public T? Value => _value;

    public void Set(T value)
    {
        _value = value;
        Signal();
    }

    public void Fail(Exception error)
    {
        _error = error;
        Signal();
    }

    public async IAsyncEnumerable<T> Watch([EnumeratorCancellation] CancellationToken ct = default)
    {
        T? last = null;
        while (true)
        {
            var changed = _changed.Task;
            if (_error is not null)
                throw _error;
            if (_value is { } value && !ReferenceEquals(value, last))
            {
                last = value;
                yield return value;
            }
            await changed.WaitAsync(ct);
        }
    }

    private void Signal()
    {
        var previous = _changed;
        _changed = new(TaskCreationOptions.RunContinuationsAsynchronously);
        previous.TrySetResult();
    }
}
