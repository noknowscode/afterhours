using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace Afterhours.Uno.Services;

// Rooms as the game reports them: the navigator, the room you are in, and the piece you clicked.

// Kind is public, mine or shared (another resident's room in a shared session); Door is open, doorbell or private.
public sealed partial record RoomEntry(string Key, string Name, string Description, string Kind, string? Door);

// Shared is the connected navigator (no favorites or history there).
public sealed partial record RoomsState(bool Shared, ImmutableList<string> Favorites, ImmutableList<string> History, ImmutableList<RoomEntry> Entries)
{
    public static RoomsState Empty { get; } = new(false, [], [], []);
}

public sealed partial record RoomNote(string Id, string Text, string Name);

public sealed partial record RoomRule(string Id, string Trigger, string Effect, string Phrase, string Message);

// Start is the game's clock (milliseconds since 1970).
public sealed partial record RoomEvent(string Name, double Start);

// Personal is false in a public hangout: room tools then offer the way home. Hosting is the room's event
// (a member named Event breaks MVUX's generated bindable proxy).
public sealed partial record RoomState(bool Personal, string Id, string Name, string Description, string Tags, string Lighting, string Door,
    ImmutableList<RoomNote> Notes, ImmutableList<RoomRule> Rules, [property: JsonPropertyName("event")] RoomEvent? Hosting, ImmutableList<RoomRef> OtherRooms)
{
    public static RoomState Empty { get; } = new(false, "", "", "", "", "amber", "open", [], [], null, []);
}

// The piece a click opened, with the game's own action labels (the game runs them by index).
public sealed partial record RoomObject(string ItemId, string Type, string Name, string Text, ImmutableList<string> Actions);

public sealed partial record ArcadeGame(string Id, string Title, string Description, string Instructions, string Icon, int Best);

public sealed partial record ArcadeState(ImmutableList<ArcadeGame> Games);

public sealed partial record Pet(string Name, int Hunger, int Happiness, int Energy, bool Following, int Xp, ImmutableList<string> Tricks);

// Pet is null until one is adopted.
public sealed partial record PetState(Pet? Pet)
{
    public static PetState None { get; } = new((Pet?)null);
}
