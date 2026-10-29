using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Links a portal to one of your other rooms.
public partial record PortalModel(IRooms Rooms, INavigator Navigator, ItemRequest Request)
{
    public ImmutableList<RoomRef> Destinations { get; } = Rooms.Room().OtherRooms;

    public bool HasDestinations => !Destinations.IsEmpty;

    public bool HasNone => Destinations.IsEmpty;

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Link(RoomRef room, CancellationToken ct)
    {
        var reply = Rooms.LinkPortal(Request.ItemId, room.Id);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.CloseSheetAsync(this, ct);
    }
}
