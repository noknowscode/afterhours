using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The room navigator: public hangouts and your rooms (tabs and search), or the shared navigator when connected.
// Creating a room happens in place.
public partial record RoomsModel(IRooms Rooms, INavigator Navigator, RoomsRequest Request)
{
    private readonly RoomsState _opened = Rooms.Rooms();

    public bool IsShared => _opened.Shared;

    public bool IsSolo => !_opened.Shared;

    public string Eyebrow => _opened.Shared ? "SHARED NAVIGATOR" : "ROOM NAVIGATOR";

    public string Title => _opened.Shared ? "Rooms with a heartbeat" : "Find your people";

    public IState<string> Filter => State.Value(this, () => Request.Filter);

    public IFeed<RoomTabs> Tabs => Filter.Select(filter => new RoomTabs(filter));

    public IState<string> Query => State.Value(this, () => "");

    public IListFeed<RoomCard> Cards => Feed.Combine(Filter, Query)
        .Select(x => (IImmutableList<RoomCard>)RoomRules.Cards(_opened, x.Item1, x.Item2 ?? "")).AsListFeed();

    public IFeed<bool> IsEmpty => Feed.Combine(Filter, Query).Select(x => RoomRules.Cards(_opened, x.Item1, x.Item2 ?? "").IsEmpty);

    public IState<CreateRoomView> Create => State.Value(this, () => CreateRoomView.Closed);

    public IState<string> NewName => State.Value(this, () => "");

    public IState<string> NewDescription => State.Value(this, () => "");

    public IState<string> NewTags => State.Value(this, () => "music, hangout");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask ShowTab(string filter, CancellationToken ct) => await Filter.UpdateAsync(_ => filter, ct);

    public async ValueTask Enter(RoomCard card, CancellationToken ct)
    {
        var reply = await Rooms.GoTo(card.Key);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.NavigateBackAsync(this, cancellation: ct);
    }

    public async ValueTask OpenCreate(CancellationToken ct) => await Create.UpdateAsync(_ => new CreateRoomView(true), ct);

    public async ValueTask CancelCreate(CancellationToken ct)
    {
        await Create.UpdateAsync(_ => CreateRoomView.Closed, ct);
        await Error.UpdateAsync(_ => "", ct);
    }

    public async ValueTask CreateRoom(CancellationToken ct)
    {
        var reply = Rooms.CreateRoom(await NewName ?? "", await NewDescription ?? "", await NewTags ?? "");
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.NavigateBackAsync(this, cancellation: ct);
    }
}
