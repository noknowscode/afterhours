using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

public sealed partial record CatalogRequest(string Tab);

public sealed partial record WrapGiftRequest(string ItemId);

// Where to draw an atlas so one crop fills a box: the crop is scaled to fit and sits on the box's floor line,
// matching the game's card art (288×222 of a 320×250 card, floor at 238). Clip* is the crop's rectangle in the
// box, so neighbouring sprites in the atlas stay hidden.
public sealed partial record ArtFrame(string Url, double Left, double Top, double Width, double Height,
    double ClipX, double ClipY, double ClipWidth, double ClipHeight)
{
    // A value type, so it reaches converters as is: MVUX wraps a record read through a state in a bindable proxy.
    public System.Drawing.RectangleF ClipRect => new((float)ClipX, (float)ClipY, (float)ClipWidth, (float)ClipHeight);

    public static ArtFrame None { get; } = new("", 0, 0, 0, 0, 0, 0, 0, 0);

    public static ArtFrame Fit(ShopEntry entry, double boxWidth, double boxHeight)
    {
        var (x, y, w, h) = (entry.Crop[0], entry.Crop[1], entry.Crop[2], entry.Crop[3]);
        var scale = Math.Min(boxWidth * 0.9 / w, boxHeight * 0.888 / h);
        var (clipX, clipY) = ((boxWidth - w * scale) / 2, boxHeight * 0.952 - h * scale);
        return new(entry.Atlas.Url, clipX - x * scale, clipY - y * scale,
            entry.Atlas.Width * scale, entry.Atlas.Height * scale, clipX, clipY, w * scale, h * scale);
    }
}

// One card in the shop or inventory grid. ItemId is set for owned pieces.
public sealed partial record CatalogCard(string Type, string Name, int Price, string Detail, string? ItemId, string Description, string Facts, ArtFrame Art, ArtFrame Preview)
{
    public bool Owned => ItemId is not null;
    public string PrimaryLabel => Owned ? "Place / move piece" : $"Buy for {Price} ✦";
}

public sealed partial record CatalogSelection(CatalogCard? Card)
{
    public static CatalogSelection None { get; } = new((CatalogCard?)null);
    public bool IsOpen => Card is not null;
    public bool CanInteract => Card?.Owned == true;
}

public sealed partial record CatalogTabs(string Tab)
{
    public bool IsShop => Tab == "shop";
    public bool IsOwned => Tab == "owned";
    public bool IsDiscs => Tab == "discs";
    public bool ShowsFurniture => !IsDiscs;
}

public sealed partial record CollectionChip(string Key, string Name, int Count, bool Selected)
{
    public override string ToString() => $"{Name}, {Count} pieces";
}

public sealed partial record CollectionHeading(string Name, string Tagline);

public sealed partial record DiscView(string Id, string Title, string Detail)
{
    public override string ToString() => $"{Title}, {Detail}";
}

public sealed partial record BlueprintView(string Id, string Name, string Pieces);

public sealed partial record GiftOption(string Id, string Name)
{
    public override string ToString() => Name;
}

public static class ShopRules
{
    public const double CardWidth = 140, CardHeight = 118, PreviewWidth = 320, PreviewHeight = 250;

    public static string Detail(ShopEntry e) => $"{e.Price} ✦" + (e.Seats > 0 ? $" · {e.Seats} {(e.Seats == 1 ? "seat" : "seats")}" : "");

    public static CatalogCard Card(ShopEntry e, OwnedItem? item, Inventory inventory) => new(
        e.Type, e.Name, e.Price,
        item is null ? Detail(e) : item.InInventory ? "In inventory" : inventory.Rooms.FirstOrDefault(r => r.Id == item.RoomId)?.Name ?? "In room",
        item?.Id, e.Description,
        $"{e.W} × {e.D} tiles · " + (item is null ? $"{e.Price} ✦" : "Owned"),
        ArtFrame.Fit(e, CardWidth, CardHeight), ArtFrame.Fit(e, PreviewWidth, PreviewHeight));

    // The game's filter: collection, category, then a search across name, description and collection.
    public static bool Matches(ShopEntry e, string collection, string category, string query) =>
        (collection == "all" || e.Collection == collection)
        && (category == "all" || e.Category == category)
        && $"{e.Name} {e.Description} {e.Collection}".Contains(query.Trim(), StringComparison.OrdinalIgnoreCase);

    public static ImmutableList<CatalogCard> Cards(ShopData shop, Inventory inventory, string tab, string collection, string category, string query)
    {
        var entries = shop.Entries.ToDictionary(e => e.Type);
        if (tab == "owned")
            return inventory.Items
                .Where(i => i.Wrapped != true && entries.ContainsKey(i.Type) && Matches(entries[i.Type], collection, category, query))
                .Select(i => Card(entries[i.Type], i, inventory)).ToImmutableList();
        // Featured collection pieces first, as in the game.
        return shop.Entries.OrderByDescending(e => e.Featured)
            .Where(e => Matches(e, collection, category, query))
            .Select(e => Card(e, null, inventory)).ToImmutableList();
    }

    // Pieces a gift box can hold (game-core's rule for the wrap action).
    public static ImmutableList<GiftOption> GiftOptions(ShopData shop, Inventory inventory, string giftId) =>
        inventory.Items.Where(i => i.Id != giftId && i.InInventory && i.Wrapped != true && i.Contents is null)
            .Select(i => new GiftOption(i.Id, shop.Entries.FirstOrDefault(e => e.Type == i.Type)?.Name ?? i.Type)).ToImmutableList();
}
