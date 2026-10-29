using System.Collections.Immutable;
using Afterhours.Uno.Presentation;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class SocialRulesTests
{
    private static readonly Trade Open = new("t1", "open", "kai", false, false, true, false, false, false,
        [new("you", true, []), new("kai", false, ["Lamp", "Plant"])],
        [new("i1", "Sofa", true), new("i2", "Speaker", false)]);

    private static SocialState Connected(params Trade[] trades) => SocialState.Empty with
    {
        Ready = true, Connected = true, Name = "you",
        Peers = [new("p1", "kai", 3, "night owl", true, "Here tonight")],
        Friends = [new("f1", "ren", 2, "", false, "Seen 5 min ago")],
        Trades = [.. trades],
    };

    [Fact]
    public void World_mode_follows_the_service_and_the_join()
    {
        Assert.Equal(new WorldMode(true, false, false), SocialRules.Mode(SocialState.Empty));
        Assert.Equal(new WorldMode(false, true, false), SocialRules.Mode(SocialState.Empty with { Ready = true }));
        Assert.Equal(new WorldMode(false, false, true), SocialRules.Mode(Connected()));
        Assert.Equal("Connected as you · 1 other players in this room", SocialRules.Banner(Connected()));
    }

    [Fact]
    public void A_player_is_found_in_the_room_or_among_friends()
    {
        Assert.Equal("kai", SocialRules.Player(Connected(), "p1")?.Name);
        Assert.Equal("ren", SocialRules.Player(Connected(), "f1")?.Name);
        Assert.Null(SocialRules.Player(Connected(), "nobody"));
        Assert.Equal(["ren, Seen 5 min ago"], SocialRules.Friends(Connected()).Select(f => f.ToString()));
    }

    [Fact]
    public void Only_live_trades_are_invites()
    {
        var done = Open with { Id = "t2", Status = "completed", Open = false, Closed = true, Completed = true };
        Assert.Equal(["Furniture trade · kai ↗"], SocialRules.Invites(Connected(Open, done)).Select(i => i.Label));
    }

    [Fact]
    public void Picks_start_from_the_offer_and_toggle()
    {
        Assert.Equal([true, false], SocialRules.Pieces(Open, null).Select(p => p.Offered));
        var picked = SocialRules.Toggle(Open, null, "i2");
        Assert.Equal(["i1", "i2"], picked.Order());
        Assert.Equal([false, true], SocialRules.Pieces(Open, SocialRules.Toggle(Open, picked, "i1")).Select(p => p.Offered));
    }

    [Fact]
    public void Trade_titles_and_sides_read_like_the_game()
    {
        Assert.Equal("An exchange between friends", SocialRules.TradeTitle(Open));
        Assert.Equal("A fair exchange.", SocialRules.TradeTitle(Open with { Open = false, Closed = true, Completed = true }));
        Assert.Equal("Trade closed", SocialRules.TradeTitle(null));
        Assert.Equal(["you ✓: No pieces offered", "kai: Lamp, Plant"], SocialRules.Sides(Open).Select(s => s.ToString()));
    }

    [Fact]
    public void Social_state_reads_the_solo_shape()
    {
        const string json = """{"circle":["miso"],"ready":false,"connected":false,"managed":false}""";
        var state = System.Text.Json.JsonSerializer.Deserialize(json, BridgeJsonContext.Default.SocialState)!;
        Assert.Equal(["miso, resident character"], SocialRules.Circle(state).Select(c => c.ToString()));
        Assert.Empty(SocialRules.Peers(state));
        Assert.Empty(SocialRules.Invites(state));
    }
}
