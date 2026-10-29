using System.Collections.Immutable;
using System.Text.Json;

namespace Afterhours.Uno.Services;

// Turns host.mjs events into the latest values the app shows. Pure .NET, so it is unit-tested.
public sealed class GameEvents
{
    private readonly Dictionary<string, JsonElement> _slices = [];

    public Latest<BridgeStatus> Status { get; } = new();
    public Latest<ImmutableList<PublicRoom>> PublicRooms { get; } = new();
    public Latest<Hud> Hud { get; } = new();
    public Latest<Portrait> Portrait { get; } = new();
    public Latest<Chrome> Chrome { get; } = new();
    public Latest<ChatState> Chat { get; } = new();
    public Latest<ShopData> Shop { get; } = new();
    public Latest<Inventory> Inventory { get; } = new();
    public Latest<ImmutableList<Song>> Songs { get; } = new();
    // Nothing plays until the game says so.
    public Latest<Playback> Playback { get; } = Seeded(Services.Playback.Stopped);

    // Sent only while a stage panel watches.
    public Latest<StageView> Stage { get; } = new();
    public EventStream<OpenRequest> OpenRequests { get; } = new();

    // Sent only while a social panel watches.
    public Latest<SocialState> Social { get; } = new();

    // Whisper targets picked in a panel, for the chat box (raised in .NET, not by the game).
    public EventStream<string> Whispers { get; } = new();

    // Save keys the Inventory projection is built from.
    private static readonly string[] InventoryKeys = ["coins", "activeRoom", "items", "rooms", "discs", "blueprints"];

    private static Latest<T> Seeded<T>(T value) where T : class
    {
        var latest = new Latest<T>();
        latest.Set(value);
        return latest;
    }

    public bool TryGetSlice(string key, out JsonElement value) => _slices.TryGetValue(key, out value);

    public void Receive(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var ctx = BridgeJsonContext.Default;
        switch (root.GetProperty("type").GetString())
        {
            case "ready":
                PublicRooms.Set(root.Deserialize(ctx.ReadyEvent)!.PublicRooms);
                Status.Set(new BridgeStatus(true));
                break;
            case "slices":
                var changed = false;
                foreach (var slice in root.GetProperty("slices").EnumerateObject())
                {
                    _slices[slice.Name] = slice.Value.Clone();
                    changed |= InventoryKeys.Contains(slice.Name);
                    if (slice.Name == "songs")
                        Songs.Set(slice.Value.Deserialize(ctx.ImmutableListSong)!);
                }
                if (changed && InventoryKeys.All(_slices.ContainsKey))
                    Inventory.Set(new Inventory(
                        _slices["coins"].GetInt32(), _slices["activeRoom"].GetString() ?? "",
                        _slices["items"].Deserialize(ctx.ImmutableListOwnedItem)!, _slices["rooms"].Deserialize(ctx.ImmutableListRoomRef)!,
                        _slices["discs"].Deserialize(ctx.ImmutableListDisc)!, _slices["blueprints"].Deserialize(ctx.ImmutableListBlueprint)!));
                break;
            case "shop":
                Shop.Set(root.GetProperty("shop").Deserialize(ctx.ShopData)!);
                break;
            case "stage":
                Stage.Set(root.GetProperty("stage").Deserialize(ctx.StageView) ?? StageView.Closed);
                break;
            case "social":
                Social.Set(root.GetProperty("social").Deserialize(ctx.SocialState) ?? SocialState.Empty);
                break;
            case "playback":
                Playback.Set(root.GetProperty("playback").Deserialize(ctx.Playback)!);
                break;
            case "open":
                OpenRequests.Publish(root.Deserialize(ctx.OpenRequest)!);
                break;
            case "hud":
                Hud.Set(root.GetProperty("hud").Deserialize(ctx.Hud)!);
                break;
            case "portrait":
                Portrait.Set(root.Deserialize(ctx.Portrait)!);
                break;
            case "chrome":
                Chrome.Set(root.GetProperty("chrome").Deserialize(ctx.Chrome)!);
                break;
            case "chat":
                Chat.Set(root.GetProperty("chat").Deserialize(ctx.ChatState)!);
                break;
        }
    }

    public void Fail(Exception error)
    {
        Status.Fail(error);
        Hud.Fail(error);
    }
}
