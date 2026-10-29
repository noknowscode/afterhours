using System.Text.Json;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class GameEventsTests
{
    // The same events the Node tests check against host.mjs (tests/fixtures/host-events.json).
    private static GameEvents Loaded()
    {
        var events = new GameEvents();
        foreach (var e in JsonDocument.Parse(Repo.Read("tests/fixtures/host-events.json")).RootElement.EnumerateArray())
            events.Receive(e.GetRawText());
        return events;
    }

    [Fact]
    public void Ready_marks_the_bridge_ready_and_lists_public_rooms()
    {
        var events = Loaded();
        Assert.True(events.Status.Value!.Ready);
        Assert.Equal("Side B", events.PublicRooms.Value![0].Title);
        Assert.Equal("late-night jazz · 4", events.PublicRooms.Value[1].Detail);
    }

    [Fact]
    public void Hud_parses_with_derived_labels()
    {
        var hud = Loaded().Hud.Value!;
        Assert.Equal(240, hud.Coins);
        Assert.Equal("LEVEL 01", hud.LevelLabel);
        Assert.InRange(hud.XpProgress, 0, 1);
        Assert.False(hud.DailyClaimed);
        Assert.Equal("Daily gift · 35 ✦", hud.DailyLabel);
    }

    [Fact]
    public void Chrome_and_chat_parse_nested_records()
    {
        var events = Loaded();
        var chrome = events.Chrome.Value!;
        Assert.Equal("public:0", chrome.Room.Key);
        Assert.Equal("Save", chrome.Room.SaveLabel);
        Assert.False(chrome.Editor.Active);
        Assert.Equal("▶", chrome.NowPlaying.PlayGlyph);
        Assert.Equal("SOLO WORLD", chrome.Connection.Label);
        var chat = events.Chat.Value!;
        Assert.True(chat.Lines[0].System);
        Assert.Equal("#0f7a6c", chat.Lines[1].Color);
        Assert.Equal("miso", chat.WhisperTargets[0].Id);
    }

    [Fact]
    public void Slices_are_kept_and_unknown_events_are_ignored()
    {
        var events = Loaded();
        Assert.True(events.TryGetSlice("coins", out var coins));
        Assert.Equal(160, coins.GetInt32()); // the later slice (after a purchase) replaces the first
        Assert.True(events.TryGetSlice("profile", out _));
        Assert.False(events.TryGetSlice("friends", out _));
    }

    [Fact]
    public void Inventory_is_built_once_every_save_slice_it_needs_has_arrived()
    {
        var inventory = Loaded().Inventory.Value!;
        Assert.Equal("home", inventory.ActiveRoom);
        Assert.Equal("Your afterhours", inventory.Rooms[0].Name);
        var bought = Assert.Single(inventory.Items, i => i.InInventory);
        Assert.Equal("bought-sofa", bought.Id);
        Assert.Equal("Side B", inventory.Discs[0].Song.Title);
        Assert.Equal("bp-1", inventory.Blueprints[0].Id);
    }

    [Fact]
    public void Shop_parses_entries_with_their_atlas_crop()
    {
        var shop = Loaded().Shop.Value!;
        Assert.Equal("Soft loft", shop.Collections[0].Name);
        Assert.Equal([200, 0, 100, 150], shop.Entries[1].Crop.ToArray());
        Assert.Equal(1024, shop.Entries[0].Atlas.Width);
    }

    [Fact]
    public async Task Open_requests_reach_watchers_and_are_not_replayed()
    {
        var events = new GameEvents();
        events.Receive("""{"type":"open","route":"Catalog","data":{"tab":"owned"}}""");
        using var cts = new CancellationTokenSource();
        var watcher = events.OpenRequests.Watch(cts.Token).GetAsyncEnumerator();
        var next = watcher.MoveNextAsync();
        events.Receive("""{"type":"open","route":"WrapGift","data":{"itemId":"bought-sofa"}}""");
        Assert.True(await next);
        Assert.Equal("WrapGift", watcher.Current.Route);
        Assert.Equal("bought-sofa", watcher.Current.Text("itemId"));
        Assert.Null(watcher.Current.Text("tab"));
        await cts.CancelAsync();
    }

    [Fact]
    public void A_failure_surfaces_to_status_watchers()
    {
        var events = new GameEvents();
        events.Fail(new TimeoutException("Your world took too long to open."));
        var error = Assert.ThrowsAsync<TimeoutException>(async () => { await foreach (var _ in events.Status.Watch()) { } });
        Assert.Equal("Your world took too long to open.", error.Result.Message);
    }
}
