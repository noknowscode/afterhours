using Afterhours.Uno.Presentation;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class RoomRulesTests
{
    private static readonly RoomsState Solo = new(false, ["public:1"], ["my:b", "public:0"],
    [
        new("public:0", "Side B", "Records and late talk", "public", null),
        new("public:1", "Midnight Diner", "Coffee all night", "public", null),
        new("my:a", "Loft", "Slow evenings", "mine", null),
        new("my:b", "Studio", "Make some noise", "mine", null),
    ]);

    [Fact]
    public void Tabs_filter_the_way_the_game_did()
    {
        Assert.Equal(["public:0", "public:1", "my:a", "my:b"], RoomRules.Cards(Solo, "all", "").Select(c => c.Key));
        Assert.Equal(["my:a", "my:b"], RoomRules.Cards(Solo, "mine", "").Select(c => c.Key));
        Assert.Equal(["public:1"], RoomRules.Cards(Solo, "favorites", "").Select(c => c.Key));
        // Recent keeps the history's order.
        Assert.Equal(["my:b", "public:0"], RoomRules.Cards(Solo, "recent", "").Select(c => c.Key));
    }

    [Fact]
    public void Search_matches_name_or_description_in_any_case()
    {
        Assert.Equal(["public:1"], RoomRules.Cards(Solo, "all", "COFFEE").Select(c => c.Key));
        Assert.Equal(["my:b"], RoomRules.Cards(Solo, "mine", " studio ").Select(c => c.Key));
        Assert.Empty(RoomRules.Cards(Solo, "all", "nowhere"));
    }

    [Fact]
    public void Shared_navigator_ignores_tabs_and_shows_the_door()
    {
        var shared = new RoomsState(true, [], [],
        [
            new("public:0", "Side B", "Public hangout", "public", "open"),
            new("home:u:1", "Den", "by kai · 2 guests · doorbell", "shared", "doorbell"),
            new("home:u:2", "Patio", "by kai · 0 guests · open", "shared", "open"),
        ]);
        Assert.Equal(["PUBLIC ↗", "Ring ↗", "Enter ↗"], RoomRules.Cards(shared, "mine", "").Select(c => c.Badge));
        Assert.Equal("YOURS ↗", RoomRules.Badge(new("my:a", "Loft", "", "mine", null)));
    }

    [Fact]
    public void Rules_read_as_when_then()
    {
        var room = RoomState.Empty with { Rules = [new("r1", "say", "lights", "lights please", ""), new("r2", "enter", "message", "", "Hi")] };
        Assert.Equal(["When say “lights please” → lights", "When enter → message"], RoomRules.Rules(room).Select(r => r.Text));
    }

    [Fact]
    public void First_object_action_is_the_primary_one()
    {
        var actions = RoomRules.Actions(new RoomObject("i1", "lamp", "Lamp", "", ["Turn light off", "Link to a room"]));
        Assert.Equal([(0, true), (1, false)], actions.Select(a => (a.Index, a.Primary)));
        Assert.Empty(RoomRules.Actions(null));
    }

    [Fact]
    public void Companion_needs_and_tricks()
    {
        var pet = new Pet("Biscuit", 80, 55, 30, false, 40, ["sit"]);
        Assert.Equal(["Full belly 80%", "Happiness 55%", "Energy 30%"], RoomRules.Needs(pet).Select(n => n.ToString()));
        Assert.Equal(["Sit ↗"], RoomRules.Tricks(pet).Select(t => t.Name));
        Assert.Contains("Training XP: 40.", RoomRules.Training(pet));
    }

    [Fact]
    public void Room_state_reads_the_games_json()
    {
        const string json = """{"ok":true,"error":null,"result":{"personal":true,"id":"a","name":"Loft","description":"","tags":"","lighting":"rose","door":"open","notes":[{"id":"n","text":"hi","name":"Kai"}],"rules":[],"event":{"name":"Party","start":1700000000000},"otherRooms":[{"id":"b","name":"Studio"}]}}""";
        var reply = System.Text.Json.JsonSerializer.Deserialize(json, BridgeJsonContext.Default.HostReplyRoomState)!;
        Assert.Equal("Party", reply.Result!.Hosting!.Name);
        Assert.Equal("Studio", reply.Result.OtherRooms[0].Name);
        Assert.Equal("hi", reply.Result.Notes[0].Text);
    }
}
