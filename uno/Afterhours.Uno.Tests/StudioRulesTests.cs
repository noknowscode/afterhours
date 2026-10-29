using System.Collections.Immutable;
using System.Text.Json;
using Afterhours.Uno.Presentation;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class StudioRulesTests
{
    private static GameEvents Loaded()
    {
        var events = new GameEvents();
        foreach (var e in JsonDocument.Parse(Repo.Read("tests/fixtures/host-events.json")).RootElement.EnumerateArray())
            events.Receive(e.GetRawText());
        return events;
    }

    private static Song Sketch => Loaded().Songs.Value![0];

    [Fact]
    public void Songs_and_playback_parse_from_the_game()
    {
        var events = Loaded();
        Assert.Equal("Side B sketch", Sketch.Title);
        Assert.Equal(4, Sketch.Pattern.Length);
        Assert.All(Sketch.Pattern, row => Assert.Equal(16, row.Length));
        Assert.Equal(new Playback(true, "Side B sketch", 5), events.Playback.Value);
        Assert.Equal(Playback.Stopped, new GameEvents().Playback.Value);
    }

    [Fact]
    public void The_board_is_a_ruler_over_four_lanes_keyed_by_cell()
    {
        var ruler = StudioRules.Ruler(16);
        Assert.Equal(["1", "·", "·", "·", "2"], ruler.Take(5).Select(c => c.Label));
        Assert.All(ruler, c => Assert.True(c.IsRuler));
        var cells = StudioRules.Cells(Sketch);
        Assert.Equal(4 * 16, cells.Count);
        var kick = cells.Take(16).ToList();
        Assert.Equal("0:0", kick[0].Key);
        Assert.Equal(Sketch.Pattern[0].Select(v => v == 1), kick.Select(c => c.On));
        Assert.Equal("KICK step 1, on", kick[0].Name);
        Assert.Equal("KICK step 2, off", kick[1].Name);
        Assert.Equal(cells.Count, cells.Select(c => c.Key).Distinct().Count());
    }

    [Fact]
    public void Lanes_show_mute_and_volume_in_percent()
    {
        var lanes = StudioRules.Lanes(Sketch with { Muted = [true, false, false, false], Volumes = [0.25, 0.7, 0.7, 1] });
        Assert.Equal(["KICK", "SNARE", "HI-HAT", "MELODY"], lanes.Select(l => l.Name));
        Assert.True(lanes[0].Muted);
        Assert.Equal([25d, 70, 70, 100], lanes.Select(l => l.Volume));
        Assert.Equal("Solo SNARE", lanes[1].SoloName);
    }

    [Fact]
    public void The_playhead_follows_the_sounding_step_only_while_playing()
    {
        Assert.Equal(new PlayState(true, 5 * StudioRules.CellPitch, true), StudioRules.Play(new Playback(true, "x", 5)));
        Assert.False(StudioRules.Play(new Playback(true, "x", -1)).ShowPlayhead);
        Assert.False(StudioRules.Play(Playback.Stopped).ShowPlayhead);
        Assert.Equal("▶ Play", StudioRules.Play(Playback.Stopped).Label);
        Assert.Equal("Ⅱ Pause", StudioRules.Play(new Playback(true, "x", 0)).Label);
    }

    [Fact]
    public void Library_cards_and_jukebox_options_describe_each_song()
    {
        var songs = Loaded().Songs.Value!;
        var card = Assert.Single(StudioRules.Library(songs));
        Assert.Equal($"{Sketch.Bpm} BPM · {Sketch.Pack} · 16 steps", card.Detail);
        Assert.Equal(StudioRules.Sleeve(Sketch.Pack), card.Sleeve);
        Assert.Equal("#6A857F", StudioRules.Sleeve("club"));
        Assert.True(StudioRules.Jukebox(songs, [Sketch.Id])[0].Chosen);
        Assert.False(StudioRules.Jukebox(songs, ImmutableHashSet<string>.Empty)[0].Chosen);
    }
}
