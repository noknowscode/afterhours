using System.Text.Json;
using Afterhours.Uno.Presentation;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class ShopRulesTests
{
    private static (ShopData Shop, Inventory Inventory) Loaded()
    {
        var events = new GameEvents();
        foreach (var e in JsonDocument.Parse(Repo.Read("tests/fixtures/host-events.json")).RootElement.EnumerateArray())
            events.Receive(e.GetRawText());
        return (events.Shop.Value!, events.Inventory.Value!);
    }

    [Fact]
    public void Shop_cards_put_featured_pieces_first_and_follow_the_filters()
    {
        var (shop, inventory) = Loaded();
        Assert.Equal(["table", "sofa"], ShopRules.Cards(shop, inventory, "shop", "all", "all", "").Select(c => c.Type));
        Assert.Equal(["sofa"], ShopRules.Cards(shop, inventory, "shop", "all", "seating", "").Select(c => c.Type));
        Assert.Equal(["table"], ShopRules.Cards(shop, inventory, "shop", "loft", "all", " COFFEE ").Select(c => c.Type));
        Assert.Empty(ShopRules.Cards(shop, inventory, "shop", "diner", "all", ""));
    }

    [Fact]
    public void Card_details_name_price_seats_and_where_an_owned_piece_is()
    {
        var (shop, inventory) = Loaded();
        Assert.Equal("75 ✦ · 2 seats", ShopRules.Detail(shop.Entries[0]));
        Assert.Equal("35 ✦", ShopRules.Detail(shop.Entries[1]));
        var owned = ShopRules.Cards(shop, inventory, "owned", "all", "all", "");
        // Only sofas are both owned and sold in this fixture: the starter one in the room and the bought one.
        Assert.Equal(["Your afterhours", "In inventory"], owned.Select(c => c.Detail));
        Assert.All(owned, c => Assert.Equal("Place / move piece", c.PrimaryLabel));
        Assert.Equal("Buy for 75 ✦", ShopRules.Cards(shop, inventory, "shop", "all", "seating", "")[0].PrimaryLabel);
    }

    [Fact]
    public void Gift_options_are_unwrapped_inventory_pieces_other_than_the_gift()
    {
        var (shop, inventory) = Loaded();
        Assert.Equal([new GiftOption("bought-sofa", "Mint daybed sofa")], ShopRules.GiftOptions(shop, inventory, "gift-box"));
        Assert.Empty(ShopRules.GiftOptions(shop, inventory, "bought-sofa"));
    }

    [Fact]
    public void Art_frame_fits_the_crop_on_the_floor_line_and_clips_to_it()
    {
        var entry = Loaded().Shop.Entries[0]; // crop 200 × 150 at the atlas origin
        var art = ArtFrame.Fit(entry, 150, 118);
        var scale = Math.Min(150 * 0.9 / 200, 118 * 0.888 / 150);
        Assert.Equal(1024 * scale, art.Width, 6);
        Assert.Equal(200 * scale, art.ClipWidth, 6);
        Assert.Equal(118 * 0.952, art.ClipY + art.ClipHeight, 6);
        Assert.Equal((150 - art.ClipWidth) / 2, art.ClipX, 6);
        Assert.Equal(art.ClipX, art.Left, 6); // crop starts at x = 0
        Assert.Equal((float)art.ClipHeight, art.ClipRect.Height);
    }
}
