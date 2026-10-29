using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Host an event: a name and a start, shown above the room with a countdown. Ends the current one too.
public partial record RoomEventModel(IRooms Rooms, INavigator Navigator)
{
    private readonly RoomState _opened = Rooms.Room();

    public bool HasEvent => _opened.Hosting is not null;

    public IState<string> Name => State.Value(this, () => _opened.Hosting?.Name ?? "Listening party");

    public IReadOnlyList<Choice> Delays => RoomRules.Delays;

    public IState<string> Delay => State.Value(this, () => "0");

    public async ValueTask Host(CancellationToken ct)
    {
        Rooms.HostEvent(await Name ?? "", int.TryParse(await Delay, out var minutes) ? minutes : 0);
        await Navigator.NavigateBackAsync(this, cancellation: ct);
    }

    public async ValueTask End(CancellationToken ct)
    {
        Rooms.EndEvent();
        await Navigator.NavigateBackAsync(this, cancellation: ct);
    }
}
