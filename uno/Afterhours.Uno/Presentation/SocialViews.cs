using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

public sealed partial record ResidentRequest(string Name);

public sealed partial record PlayerRequest(string Id);

public sealed partial record TradeRequest(string Id);

public sealed partial record CircleCard(string Name)
{
    public override string ToString() => $"{Name}, resident character";
}

public sealed partial record PlayerCard(string Id, string Name, string Detail, bool CanFollow)
{
    public override string ToString() => $"{Name}, {Detail}";
}

public sealed partial record TradeInvite(string Id, string Label)
{
    public override string ToString() => Label;
}

public sealed partial record PieceView(string Id, string Name, bool Offered)
{
    public override string ToString() => Name;
}

public sealed partial record SideView(string Title, string Pieces)
{
    public override string ToString() => $"{Title}: {Pieces}";
}

public sealed partial record PickedPieces(ImmutableHashSet<string>? Ids)
{
    public static PickedPieces None { get; } = new((ImmutableHashSet<string>?)null);
}

public sealed partial record ReportView(bool IsOpen)
{
    public static ReportView Closed { get; } = new(false);
}

// What the shared-world panel shows: the service is down, you have not joined, or you are connected.
public sealed partial record WorldMode(bool Offline, bool NotJoined, bool Connected);

public static class SocialRules
{
    public static WorldMode Mode(SocialState s) => new(!s.Ready, s.Ready && !s.Connected, s.Ready && s.Connected);

    public static string Banner(SocialState s) => $"Connected as {s.Name} · {s.Peers?.Count ?? 0} other players in this room";

    public static ImmutableList<CircleCard> Circle(SocialState s) => (s.Circle ?? []).Select(n => new CircleCard(n)).ToImmutableList();

    public static ImmutableList<PlayerCard> Peers(SocialState s) =>
        (s.Peers ?? []).Select(p => new PlayerCard(p.Id, p.Name, $"Level {p.Level} · {p.Motto}", false)).ToImmutableList();

    public static ImmutableList<PlayerCard> Friends(SocialState s) =>
        (s.Friends ?? []).Select(p => new PlayerCard(p.Id, p.Name, p.Status, p.Online)).ToImmutableList();

    // A player you clicked: in this room, or one of your friends.
    public static Player? Player(SocialState s, string id) =>
        (s.Peers ?? []).Concat(s.Friends ?? []).FirstOrDefault(p => p.Id == id);

    public static Trade? Trade(SocialState s, string id) => (s.Trades ?? []).FirstOrDefault(t => t.Id == id);

    public static ImmutableList<TradeInvite> Invites(SocialState s) => (s.Trades ?? [])
        .Where(t => t.Status is "pending" or "open")
        .Select(t => new TradeInvite(t.Id, $"Furniture trade · {t.Other} ↗")).ToImmutableList();

    // The pieces you offer: your picks while you edit, else what the trade holds.
    public static ImmutableList<PieceView> Pieces(Trade? trade, ImmutableHashSet<string>? picked) => (trade?.Inventory ?? [])
        .Select(p => new PieceView(p.Id, p.Name, picked?.Contains(p.Id) ?? p.Offered)).ToImmutableList();

    public static ImmutableHashSet<string> Toggle(Trade? trade, ImmutableHashSet<string>? picked, string id)
    {
        var current = picked ?? (trade?.Inventory ?? []).Where(p => p.Offered).Select(p => p.Id).ToImmutableHashSet();
        return current.Contains(id) ? current.Remove(id) : current.Add(id);
    }

    public static string TradeTitle(Trade? trade) => trade switch
    {
        { Completed: true } => "A fair exchange.",
        { Closed: true } or null => "Trade closed",
        _ => "An exchange between friends",
    };

    public static string TradeNote(Trade? trade) => trade switch
    {
        { Completed: true } => "Both players confirmed. Your furniture changed owners exactly once.",
        { Closed: true } or null => "Nothing changed hands.",
        _ => $"Trading with {trade.Other}. Changes to either offer clear both confirmations.",
    };

    public static ImmutableList<SideView> Sides(Trade? trade) => (trade?.Sides ?? [])
        .Select(side => new SideView(side.Confirmed ? side.Name + " ✓" : side.Name, side.Pieces.IsEmpty ? "No pieces offered" : string.Join(", ", side.Pieces)))
        .ToImmutableList();

    public static string AccountTitle(AccountStatus account) => account.Anonymous ? "Keep your place." : "Your character is linked.";

    public static string AccountText(AccountStatus account) => account.Anonymous
        ? "Link Google to bring your rooms, tracks, and furniture with you on another device."
        : "Sign in with the same Google account to recover your saved progress.";
}
