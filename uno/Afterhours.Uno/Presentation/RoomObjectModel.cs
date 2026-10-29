using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// A piece you clicked in the room: its art, its note or description, and what you can do with it.
public partial record RoomObjectModel(IRooms Rooms, IGameStore Store, INavigator Navigator, ItemRequest Request)
{
    private readonly RoomObject? _item = Rooms.Object() is { } item && item.ItemId == Request.ItemId ? item : null;

    public string Name => _item?.Name ?? "";

    public string Text => _item?.Text ?? "";

    public ImmutableList<ObjectActionView> Actions => RoomRules.Actions(_item);

    public IFeed<ShopData> Shop => Feed.AsyncEnumerable(Store.WatchShop);

    public IFeed<ArtFrame> Art => Shop.Select(shop =>
        shop.Entries.FirstOrDefault(e => e.Type == _item?.Type) is { } entry ? ArtFrame.Fit(entry, 240, 188) : ArtFrame.None);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    // The sheet closes first: most actions walk you to the piece, and the rest open the next sheet.
    public async ValueTask Run(ObjectActionView action, CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        Rooms.ObjectAction(action.Index);
    }

    public async ValueTask Move(CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        Rooms.MoveObject();
    }
}
