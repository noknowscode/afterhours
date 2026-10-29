using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

public sealed partial record StudioRequest(string Tab);

public sealed partial record StudioTabs(string Tab)
{
    public bool IsEditor => Tab == "editor";
    public bool IsLibrary => Tab == "library";
    public string Title => IsEditor ? "Find your sound" : "Your discography";
}

// One cell of the sequencer board. Row -1 is the beat ruler above the four lanes; Key keeps a toggle to one cell.
public sealed partial record StepCell(string Key, int Row, int Col, bool On, bool BarStart, string Label)
{
    public bool IsRuler => Row < 0;
    public bool IsStep => Row >= 0;
    public string Name => IsRuler ? $"Beat {Col / 4 + 1}" : $"{StudioRules.LaneNames[Row]} step {Col + 1}, {(On ? "on" : "off")}";
}

// Key is the lane index (0 kick … 3 melody); MVUX keeps a lane in place by it.
public sealed partial record LaneView(int Key, string Name, bool Muted, double Volume)
{
    public string MuteName => $"Mute {Name}";
    public string SoloName => $"Solo {Name}";
    public string VolumeName => $"{Name} volume";
}

public sealed partial record Choice(string Value, string Label)
{
    public override string ToString() => Label;
}

// Sleeve is the pack colour as "#rrggbb" (the middle of the game's sleeve gradient).
public sealed partial record SongCard(string Id, string Title, string Detail, string Pack, string Sleeve)
{
    public override string ToString() => Title;
}

public sealed partial record DeleteConfirm(SongCard? Song)
{
    public static DeleteConfirm None { get; } = new((SongCard?)null);
    public bool IsOpen => Song is not null;
    public string Message => Song is null ? "" : $"Remove “{Song.Title}” from your song library and playlists? Discs you already pressed keep their own copy.";
}

public sealed partial record JukeboxOption(string Id, string Title, string Detail, bool Chosen)
{
    public override string ToString() => Title;
}

public sealed partial record PlayState(bool Running, double PlayheadX, bool ShowPlayhead)
{
    public string Label => Running ? "Ⅱ Pause" : "▶ Play";
}

public static class StudioRules
{
    public static readonly ImmutableArray<string> LaneNames = ["KICK", "SNARE", "HI-HAT", "MELODY"];

    public static readonly ImmutableList<Choice> Packs =
        [new("velvet", "Velvet · warm & mellow"), new("club", "Club · bass & movement"), new("arcade", "Arcade · chiptune")];

    public static readonly ImmutableList<Choice> Lengths = [new("16", "1 bar · 16 steps"), new("32", "2 bars · 32 steps")];

    // What the studio shows if the game cannot answer (the game's own default song).
    public static StudioState Blank { get; } = new(new Song("", "Untitled afterhours", 88, "velvet", 16,
        [.. Enumerable.Range(0, 4).Select(_ => ImmutableArray.CreateRange(new int[16]))], [0.7, 0.7, 0.7, 0.7], [false, false, false, false]), false);

    // Cell pitch on the board: 28 px cells with 4 px gaps.
    public const double CellPitch = 32;

    // The beat ruler above the board: the beat number on each bar's first step.
    public static ImmutableList<StepCell> Ruler(int length) =>
        Enumerable.Range(0, length).Select(c => new StepCell($"ruler:{c}", -1, c, false, c % 4 == 0, c % 4 == 0 ? $"{c / 4 + 1}" : "·")).ToImmutableList();

    // The four lanes, row by row, for a grid that wraps every Length cells.
    public static ImmutableList<StepCell> Cells(Song song)
    {
        var cells = ImmutableList.CreateBuilder<StepCell>();
        for (var r = 0; r < 4; r++)
            for (var c = 0; c < song.Length; c++)
                cells.Add(new($"{r}:{c}", r, c, song.Pattern[r][c] == 1, c % 4 == 0, ""));
        return cells.ToImmutable();
    }

    public static ImmutableList<LaneView> Lanes(Song song) =>
        Enumerable.Range(0, 4).Select(r => new LaneView(r, LaneNames[r], song.Muted[r], Math.Round(song.Volumes[r] * 100))).ToImmutableList();

    public static string Detail(Song song) => $"{song.Bpm} BPM · {song.Pack} · {song.Length} steps";

    public static ImmutableList<SongCard> Library(ImmutableList<Song> songs) =>
        songs.Select(s => new SongCard(s.Id, s.Title, Detail(s), s.Pack, Sleeve(s.Pack))).ToImmutableList();

    public static string Sleeve(string pack) => pack switch { "club" => "#6A857F", "arcade" => "#86648C", _ => "#927359" };

    public static PlayState Play(Playback playback) =>
        new(playback.Running, Math.Max(0, playback.Step) * CellPitch, playback.Running && playback.Step >= 0);

    // The room's playlist order first, then the other songs, each marked if it is on the playlist.
    public static ImmutableList<JukeboxOption> Jukebox(ImmutableList<Song> songs, ImmutableHashSet<string> chosen) =>
        songs.Select(s => new JukeboxOption(s.Id, s.Title, $"{s.Bpm} BPM · {s.Pack}", chosen.Contains(s.Id))).ToImmutableList();
}
