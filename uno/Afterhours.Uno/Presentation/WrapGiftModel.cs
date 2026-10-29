using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Puts one inventory piece inside a gift box with a note.
public partial record WrapGiftModel(IGameStore Store, INavigator Navigator, WrapGiftRequest Request)
{
    public IFeed<ShopData> Shop => Feed.AsyncEnumerable(Store.WatchShop);

    public IFeed<Inventory> Inventory => Feed.AsyncEnumerable(Store.WatchInventory);

    public IListFeed<GiftOption> Options => Feed.Combine(Shop, Inventory)
        .Select(x => (IImmutableList<GiftOption>)ShopRules.GiftOptions(x.Item1, x.Item2, Request.ItemId))
        .AsListFeed();

    public IFeed<bool> HasOptions => Feed.Combine(Shop, Inventory).Select(x => ShopRules.GiftOptions(x.Item1, x.Item2, Request.ItemId).Count > 0);

    public IState<string> Contents => State.Value(this, () => "");

    public IState<string> Note => State.Value(this, () => "");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Wrap(string contents, string note, CancellationToken ct)
    {
        var reply = Store.Wrap(Request.ItemId, contents, note);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.NavigateBackAsync(this, cancellation: ct);
    }
}
