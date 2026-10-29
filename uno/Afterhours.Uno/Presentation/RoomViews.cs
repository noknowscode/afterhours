using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

public sealed partial record RoomsRequest(string Filter);

public sealed partial record ItemRequest(string ItemId);

public sealed partial record RoomTabs(string Filter)
{
    public bool IsAll => Filter == "all";
    public bool IsMine => Filter == "mine";
    public bool IsFavorites => Filter == "favorites";
    public bool IsRecent => Filter == "recent";
}

// One navigator row. Badge is what the game printed on the right: YOURS, PUBLIC, or Enter / Ring when shared.
public sealed partial record RoomCard(string Key, string Name, string Description, string Badge)
{
    public override string ToString() => $"{Name}, {Description}";
}

public sealed partial record RuleView(string Id, string Text)
{
    public override string ToString() => Text;
}

public sealed partial record CreateRoomView(bool IsOpen)
{
    public static CreateRoomView Closed { get; } = new(false);
}

public sealed partial record ObjectActionView(int Index, string Label, bool Primary)
{
    public override string ToString() => Label;
}

public sealed partial record ArcadeCard(string Id, string Title, string Description, string Instructions, string Icon, string Best)
{
    public string Play => "Play " + Title;
    public override string ToString() => $"{Title}, {Best}";
}

public sealed partial record NeedView(string Name, int Percent)
{
    public string Value => Percent + "%";
    public override string ToString() => $"{Name} {Percent}%";
}

public sealed partial record TrickView(string Id, string Name)
{
    public override string ToString() => Name;
}

public static class RoomRules
{
    public const int MaxRules = 10;

    public static ImmutableList<Choice> Triggers { get; } =
        [new("enter", "I enter the room"), new("say", "I say a phrase"), new("sit", "I take a seat"), new("dice", "I roll the dice")];

    public static ImmutableList<Choice> Effects { get; } =
        [new("lights", "Toggle the lights"), new("message", "Show a message"), new("music", "Play the room playlist")];

    public static ImmutableList<string> Lighting { get; } = ["amber", "moonlight", "rose", "daylight", "club"];

    public static ImmutableList<string> Doors { get; } = ["open", "doorbell", "private"];

    public static ImmutableList<Choice> Delays { get; } = [new("0", "Right now"), new("5", "5 minutes"), new("15", "15 minutes"), new("30", "30 minutes")];

    // The navigator's list, as the game filtered it: a tab, then a search over name and description.
    // Recent keeps the order of the game's history (most recent first).
    public static ImmutableList<RoomCard> Cards(RoomsState rooms, string filter, string query)
    {
        var shown = rooms.Entries.Where(e => rooms.Shared || filter switch
        {
            "mine" => e.Kind == "mine",
            "favorites" => rooms.Favorites.Contains(e.Key),
            "recent" => rooms.History.Contains(e.Key),
            _ => true,
        }).Where(e => (e.Name + " " + e.Description).Contains(query.Trim(), StringComparison.OrdinalIgnoreCase));
        if (!rooms.Shared && filter == "recent")
            shown = shown.OrderBy(e => rooms.History.IndexOf(e.Key));
        return shown.Select(e => new RoomCard(e.Key, e.Name, e.Description, Badge(e))).ToImmutableList();
    }

    public static string Badge(RoomEntry entry) => entry.Kind switch
    {
        "mine" => "YOURS ↗",
        "shared" when entry.Door == "doorbell" => "Ring ↗",
        "shared" => "Enter ↗",
        _ => "PUBLIC ↗",
    };

    public static ImmutableList<RuleView> Rules(RoomState room) => room.Rules
        .Select(r => new RuleView(r.Id, $"When {r.Trigger}{(r.Phrase.Length > 0 ? $" “{r.Phrase}”" : "")} → {r.Effect}"))
        .ToImmutableList();

    public static ImmutableList<ObjectActionView> Actions(RoomObject? item) =>
        item is null ? [] : item.Actions.Select((label, i) => new ObjectActionView(i, label, i == 0)).ToImmutableList();

    public static ImmutableList<ArcadeCard> Arcade(ArcadeState arcade) =>
        arcade.Games.Select(g => new ArcadeCard(g.Id, g.Title, g.Description, g.Instructions, g.Icon, $"BEST {g.Best}")).ToImmutableList();

    public static ImmutableList<NeedView> Needs(Pet pet) =>
        [new("Full belly", pet.Hunger), new("Happiness", pet.Happiness), new("Energy", pet.Energy)];

    public static ImmutableList<TrickView> Tricks(Pet pet) =>
        pet.Tricks.Select(t => new TrickView(t, (t == "sit" ? "Sit" : "Spin") + " ↗")).ToImmutableList();

    public static string Training(Pet pet) => $"Training XP: {pet.Xp}. Learn Sit at 30 XP and Spin at 75 XP.";
}
