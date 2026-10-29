using System.Collections.Immutable;

namespace Afterhours.Uno.Services;

// Songs as the game stores them (game-core's song()), the studio draft with its undo flag, and live playback.

public sealed partial record Song(
    string Id, string Title, int Bpm, string Pack, int Length,
    ImmutableArray<ImmutableArray<int>> Pattern, ImmutableArray<double> Volumes, ImmutableArray<bool> Muted);

public sealed partial record StudioState(Song Draft, bool CanUndo);

public sealed partial record StudioReply(bool Ok, string? Error, StudioState? Result)
{
    public static StudioReply NotReady { get; } = new(false, "Your world is still opening.", null);
}

// Step is the step sounding now, or -1 between steps and when stopped.
public sealed partial record Playback(bool Running, string Title, int Step)
{
    public static Playback Stopped { get; } = new(false, "", -1);
}
