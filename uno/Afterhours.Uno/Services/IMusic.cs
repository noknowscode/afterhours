namespace Afterhours.Uno.Services;

// The game's synthesizer. Phase A and B both keep it in JavaScript (Web Audio).
public interface IMusic
{
    IAsyncEnumerable<Playback> WatchPlayback(CancellationToken ct);

    // Plays a library song, or with no id toggles the studio draft.
    bool Play(string? songId);

    // Renders the draft to WAV and downloads it.
    Task<ActionReply> ExportWav();

    // Saves the room playlist and plays it in order.
    ActionReply PlayPlaylist(IEnumerable<string> songIds);
}
