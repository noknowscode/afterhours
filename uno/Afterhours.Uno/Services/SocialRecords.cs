using System.Collections.Immutable;

namespace Afterhours.Uno.Services;

// The social side as the game reports it: your circle of residents, chat preferences, and the shared world.

public sealed partial record ResidentState(string Name, string Line, bool Friend, bool Blocked);

public sealed partial record ChatPrefs(bool MuteResidents, ImmutableList<string> Blocked)
{
    public static ChatPrefs Empty { get; } = new(false, []);
}

// A connected player in this room, or a friend (Status says whether they are here, online, or when last seen).
public sealed partial record Player(string Id, string Name, int Level, string Motto, bool Online, string Status);

public sealed partial record PersonRef(string Id, string Name);

public sealed partial record TradeSide(string Name, bool Confirmed, ImmutableList<string> Pieces);

public sealed partial record TradePiece(string Id, string Name, bool Offered);

// Sides and Inventory are filled while the trade is open.
public sealed partial record Trade(string Id, string Status, string Other, bool CanAccept, bool Waiting, bool Open, bool Closed,
    bool Completed, bool Confirmed, ImmutableList<TradeSide> Sides, ImmutableList<TradePiece> Inventory);

public sealed partial record AwayItem(string Icon, string Text, string Ago);

public sealed partial record AccountStatus(bool Anonymous, bool InviteOnly);

// Before you join: the name to suggest, whether this browser already has a character, and the invite-only note.
public sealed partial record JoinInfo(string Name, bool Remembered, bool InviteOnly);

// Ready: the shared world's service answers. Connected: this player joined it. The lists are empty until then.
public sealed partial record SocialState(bool Ready, bool Connected, bool Managed, string? Name, AccountStatus? Account,
    ImmutableList<string>? Circle, ImmutableList<Player>? Peers, ImmutableList<Player>? Friends, ImmutableList<PersonRef>? Requests,
    ImmutableList<PersonRef>? Doors, ImmutableList<Trade>? Trades, bool InOwnRoom, ImmutableList<AwayItem>? Away, int AwayMore, JoinInfo? Join = null)
{
    public static SocialState Empty { get; } = new(false, false, false, null, null, [], [], [], [], [], [], false, [], 0);
}

public sealed partial record SocialReply(bool Ok, string? Error, string? Result)
{
    public static SocialReply NotReady { get; } = new(false, "Your world is still opening.", null);
}
