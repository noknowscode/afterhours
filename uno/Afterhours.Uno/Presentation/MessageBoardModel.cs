using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The room's message board: pin a note, or take one down.
public partial record MessageBoardModel(IRooms Rooms)
{
    public IState<RoomState> Room => State.Value(this, Rooms.Room);

    public IListFeed<RoomNote> Notes => Room.Select(r => (IImmutableList<RoomNote>)r.Notes).AsListFeed();

    public IState<string> Text => State.Value(this, () => "");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Pin(CancellationToken ct)
    {
        var reply = Rooms.AddNote(await Text ?? "");
        await Apply(reply, ct);
        if (reply.Ok)
            await Text.UpdateAsync(_ => "", ct);
    }

    public async ValueTask Remove(RoomNote note, CancellationToken ct) => await Apply(Rooms.DeleteNote(note.Id), ct);

    private async ValueTask Apply(HostReply<RoomState> reply, CancellationToken ct)
    {
        if (reply.Ok && reply.Result is { } room)
            await Room.UpdateAsync(_ => room, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }
}
