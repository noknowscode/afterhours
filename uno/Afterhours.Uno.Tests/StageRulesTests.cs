using System.Text.Json;
using Afterhours.Uno.Presentation;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class StageRulesTests
{
    private static StageView Shared()
    {
        var events = new GameEvents();
        foreach (var e in JsonDocument.Parse(Repo.Read("tests/fixtures/host-events.json")).RootElement.EnumerateArray())
            events.Receive(e.GetRawText());
        return events.Stage.Value!;
    }

    private static StageView Solo(StageNow? now = null, SetResult? complete = null, bool own = false) =>
        StageView.Closed with { Current = now, Complete = complete, Own = own, Performing = now?.Started == true, Songs = [new("song-1", "Side B sketch", "96 BPM · club")] };

    [Fact]
    public void The_shared_stage_parses_with_its_queue_and_chart()
    {
        var stage = Shared();
        Assert.Equal("shared", stage.Mode);
        Assert.Equal("Shared sketch", stage.Current!.Title);
        Assert.Equal("miso", stage.Queue[0].Artist);
        Assert.Equal("WEEK 44 · RESETS MONDAY", stage.Chart!.Week);
        Assert.Equal(2, stage.Chart.Top[0].Listeners);
        Assert.Null(new GameEvents().Stage.Value);
    }

    [Fact]
    public void A_null_stage_reads_as_closed()
    {
        var events = new GameEvents();
        events.Receive("""{"type":"stage","stage":null}""");
        Assert.Same(StageView.Closed, events.Stage.Value);
    }

    [Fact]
    public void Shared_screens_show_the_artist_applause_and_controls()
    {
        var screen = StageRules.Screen(Shared());
        Assert.Equal("SHARED MUSIC STAGE", screen.Eyebrow);
        Assert.Equal("by xamlalpha · 12s remaining", screen.Countdown);
        Assert.Equal(40d, screen.Progress);
        Assert.Equal("2 applause", screen.Applause);
        Assert.Equal("Ⅱ Mute stage", screen.ListenLabel);
        Assert.Equal("♡ Applaud", screen.ApplaudLabel);
        Assert.True(screen.ShowQueue && screen.ShowPicker && !screen.ShowLineup);
        Assert.Equal("Join queue ↗", screen.PickLabel);
        Assert.Equal("Applauded ✓", StageRules.Screen(Shared() with { Applauded = true }).ApplaudLabel);
        Assert.Equal("Your performance", StageRules.Screen(Shared() with { Performing = true }).ApplaudLabel);
    }

    [Fact]
    public void Solo_screens_count_down_to_the_set_then_through_it()
    {
        var waiting = StageRules.Screen(Solo(new("Side B sketch", "daydream", "YOU’RE NEXT", 3, 0, 0, false), own: true));
        Assert.Equal("3s until your set", waiting.Countdown);
        Assert.True(waiting.ShowLeave);
        Assert.False(waiting.ShowPicker || waiting.ShowLineup);
        Assert.Equal("12s remaining", StageRules.Screen(Solo(new("Side B sketch", "daydream", "ON STAGE", 12, 0.4, 2, true), own: true)).Countdown);

        var open = StageRules.Screen(Solo());
        Assert.Equal("Your moment on Side B", open.Title);
        Assert.True(open.ShowIntro && open.ShowLineup && open.ShowPicker && !open.ShowNoSongs);
        Assert.True(StageRules.Screen(Solo() with { Songs = [] }).ShowNoSongs);
    }

    [Fact]
    public void A_finished_set_replaces_the_picker_with_its_reward()
    {
        var done = StageRules.Screen(Solo(complete: new(40, "Side B sketch", 4)));
        Assert.True(done.IsComplete);
        Assert.Equal("SET COMPLETE", done.Eyebrow);
        Assert.Equal("You found your frequency", done.Title);
        Assert.Equal("+40 credits", done.Reward);
        Assert.Equal("“Side B sketch” · 4 resident reactions", done.RewardDetail);
        Assert.False(done.ShowPicker || done.ShowLineup || done.ShowIntro);
        Assert.Equal("Set complete", StageRules.Screen(Solo(complete: new(0, "Side B sketch", 1))).Reward);
    }
}
