using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Room settings (name, description, tags, lighting, door) and the way to the room's other tools.
// In a public hangout it offers the way home instead.
public partial record RoomToolsModel(IRooms Rooms, INavigator Navigator)
{
    private readonly RoomState _opened = Rooms.Room();

    public bool IsPersonal => _opened.Personal;

    public bool IsAway => !_opened.Personal;

    public string Title => _opened.Name;

    public IState<string> Name => State.Value(this, () => _opened.Name);

    public IState<string> Description => State.Value(this, () => _opened.Description);

    public IState<string> Tags => State.Value(this, () => _opened.Tags);

    public IState<string> Lighting => State.Value(this, () => _opened.Lighting);

    public IState<string> Door => State.Value(this, () => _opened.Door);

    public IReadOnlyList<string> LightingChoices => RoomRules.Lighting;

    public IReadOnlyList<string> DoorChoices => RoomRules.Doors;

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Save(CancellationToken ct)
    {
        var reply = Rooms.SaveSettings(await Name ?? "", await Description ?? "", await Tags ?? "", await Lighting ?? "amber", await Door ?? "open");
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.NavigateBackAsync(this, cancellation: ct);
    }

    // blueprints, rules, notes, playlist, event or home: this sheet closes and the game opens the next one.
    public async ValueTask Open(string panel, CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        Rooms.OpenRoomPanel(panel);
    }
}
