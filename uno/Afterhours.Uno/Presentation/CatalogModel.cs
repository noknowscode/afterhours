using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The furniture shop, your inventory and your records (the game's catalog panel, tabs and all).
public partial record CatalogModel(IGameStore Store, INavigator Navigator, CatalogRequest Request)
{
    public IFeed<ShopData> Shop => Feed.AsyncEnumerable(Store.WatchShop);

    public IFeed<Inventory> Inventory => Feed.AsyncEnumerable(Store.WatchInventory);

    public IState<string> Tab => State.Value(this, () => Request.Tab);

    public IState<string> Collection => State.Value(this, () => "all");

    public IState<string> Category => State.Value(this, () => "all");

    public IState<string> Query => State.Value(this, () => "");

    public IState<CatalogSelection> Selection => State.Value(this, () => CatalogSelection.None);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<CatalogTabs> Tabs => Tab.Select(tab => new CatalogTabs(tab));

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public IFeed<string> Balance => Inventory.Select(i => $"{i.Coins} ✦ to spend · {i.Items.Count} pieces in your collection");

    public IListFeed<ShopCategory> Categories => Shop.Select(shop => (IImmutableList<ShopCategory>)shop.Categories).AsListFeed();

    public IListFeed<CollectionChip> Collections => Feed.Combine(Shop, Collection)
        .Select(x => (IImmutableList<CollectionChip>)x.Item1.Collections.Select(c => new CollectionChip(
            c.Key, c.Name, x.Item1.Entries.Count(e => c.Key == "all" || e.Collection == c.Key), c.Key == x.Item2)).ToImmutableList())
        .AsListFeed();

    public IFeed<CollectionHeading> Heading => Feed.Combine(Shop, Collection)
        .Select(x => x.Item1.Collections.FirstOrDefault(c => c.Key == x.Item2) is { } c ? new CollectionHeading(c.Name, c.Tagline) : new CollectionHeading("", ""));

    public IListFeed<CatalogCard> Cards => Feed.Combine(Shop, Inventory, Tab, Collection, Category, Query)
        .Select(x => (IImmutableList<CatalogCard>)ShopRules.Cards(x.Item1, x.Item2, x.Item3, x.Item4, x.Item5, x.Item6))
        .AsListFeed();

    public IListFeed<DiscView> Discs => Inventory
        .Select(i => (IImmutableList<DiscView>)i.Discs.Select(d => new DiscView(d.Id, d.Song.Title, $"by {d.Artist} · {d.Song.Bpm} BPM")).ToImmutableList())
        .AsListFeed();

    public async ValueTask ShowTab(string tab, CancellationToken ct)
    {
        await Tab.UpdateAsync(_ => tab, ct);
        await Selection.UpdateAsync(_ => CatalogSelection.None, ct);
        await Error.UpdateAsync(_ => "", ct);
    }

    public async ValueTask ShowCollection(CollectionChip chip, CancellationToken ct) => await Collection.UpdateAsync(_ => chip.Key, ct);

    public async ValueTask Open(CatalogCard card, CancellationToken ct)
    {
        await Error.UpdateAsync(_ => "", ct);
        await Selection.UpdateAsync(_ => new CatalogSelection(card), ct);
    }

    public async ValueTask Back(CancellationToken ct)
    {
        await Error.UpdateAsync(_ => "", ct);
        await Selection.UpdateAsync(_ => CatalogSelection.None, ct);
    }

    // Buys the piece if needed, then takes it to a room to place (the game's flow).
    public async ValueTask Primary(CatalogSelection selection, CancellationToken ct)
    {
        if (selection.Card is not { } card)
            return;
        var id = card.ItemId;
        if (id is null)
        {
            var bought = Store.Buy(card.Type);
            if (!await Report(bought, ct))
                return;
            id = bought.Result?.Id;
        }
        if (id is not null && await Report(await Store.Place(id), ct))
            await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask Interact(CatalogSelection selection, CancellationToken ct)
    {
        if (selection.Card?.ItemId is { } id && await Report(Store.Use(id), ct))
            await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask PlayDisc(DiscView disc, CancellationToken ct) => await Report(Store.PlayDisc(disc.Id), ct);

    private async ValueTask<bool> Report(ActionReply reply, CancellationToken ct)
    {
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "That didn't work. Try again.", ct);
        return reply.Ok;
    }
}
