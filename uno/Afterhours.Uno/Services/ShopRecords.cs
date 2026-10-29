using System.Collections.Immutable;
using System.Text.Json;

namespace Afterhours.Uno.Services;

// The shop (sent once by host.mjs) and the parts of the save the shop panels read.

public sealed partial record ShopCollection(string Key, string Name, string Tagline);

public sealed partial record ShopCategory(string Key, string Name);

public sealed partial record AtlasRef(string Url, int Width, int Height);

public sealed partial record ShopEntry(
    string Type, string Name, string Description, int Price, int W, int D, int Seats,
    string Collection, string Category, bool Featured, AtlasRef Atlas, ImmutableArray<int> Crop);

public sealed partial record ShopData(ImmutableList<ShopCollection> Collections, ImmutableList<ShopCategory> Categories, ImmutableList<ShopEntry> Entries);

public sealed partial record OwnedItem(string Id, string Type, bool? Placed, string? RoomId, bool? Wrapped, string? Contents)
{
    // The game treats only placed === false as "in the inventory".
    public bool InInventory => Placed == false;
}

// Playlist holds song ids in play order (the room jukebox).
public sealed partial record RoomRef(string Id, string Name, ImmutableList<string>? Playlist = null);

public sealed partial record DiscSong(string Title, int Bpm);

public sealed partial record Disc(string Id, DiscSong Song, string Artist);

public sealed partial record BlueprintPiece(string Id);

public sealed partial record Blueprint(string Id, string Name, string Room, ImmutableList<BlueprintPiece> Items);

public sealed partial record Inventory(
    int Coins, string ActiveRoom, ImmutableList<OwnedItem> Items, ImmutableList<RoomRef> Rooms,
    ImmutableList<Disc> Discs, ImmutableList<Blueprint> Blueprints);

// A panel the game asks the app to open (route name plus its data).
public sealed partial record OpenRequest(string Route, JsonElement Data)
{
    public string? Text(string name) => Data.ValueKind == JsonValueKind.Object && Data.TryGetProperty(name, out var v) ? v.GetString() : null;
}

public sealed partial record ActionResult(string? Id);

public sealed partial record ActionReply(bool Ok, string? Error, ActionResult? Result)
{
    public static ActionReply NotReady { get; } = new(false, "Your world is still opening.", null);
}
