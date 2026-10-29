using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

public sealed partial record JournalRequest(string Tab);

public sealed partial record JournalTabs(string Tab)
{
    public bool IsQuests => Tab == "quests";
    public bool IsBadges => Tab == "badges";
    public bool IsWallet => Tab == "wallet";
}

// One quest row as the game drew it: ✓ collected, ✦ ready to collect, ○ in progress.
public sealed partial record QuestView(string Id, string Name, string Description, string Mark, double Percent, string Counts, bool CanClaim, string Action)
{
    public override string ToString() => $"{Name}, {Counts}";
}

public sealed partial record BadgeView(string Icon, string Name, string Description, string Counts, bool Unlocked)
{
    public double Fade => Unlocked ? 1 : 0.45;
    public override string ToString() => $"{Name}, {(Unlocked ? "unlocked" : Counts)}";
}

public sealed partial record LedgerView(string Reason, string Date, string Amount, bool Earned)
{
    public override string ToString() => $"{Reason}, {Amount}";
}

public sealed partial record ColorView(string Hex, string Name, bool Selected)
{
    public override string ToString() => Name;
}

// A wardrobe choice; Field names the outfit part it sets.
public sealed partial record ChoiceView(string Field, string Id, string Name, string Hex, bool Selected)
{
    public bool IsSwatch => Hex.Length > 0;
    public bool IsLabel => Hex.Length == 0;
    public override string ToString() => Name;
}

public sealed partial record PresetView(int Index, string Name)
{
    public override string ToString() => Name;
}

public sealed partial record RestoreView(RestorePrompt? Prompt)
{
    public static RestoreView None { get; } = new((RestorePrompt?)null);
    public bool IsOpen => Prompt is not null;
}

public static class ResidentRules
{
    public static ImmutableList<QuestView> Quests(JournalState journal) => journal.Quests.Select(q => new QuestView(
        q.Id, q.Name, q.Description,
        q.Claimed ? "✓" : q.Value == q.Target ? "✦" : "○",
        q.Target == 0 ? 0 : 100.0 * q.Value / q.Target,
        $"{q.Value} / {q.Target} · {q.Xp} XP",
        q.Value == q.Target && !q.Claimed,
        q.Claimed ? "Collected" : $"{q.Reward} ✦")).ToImmutableList();

    public static ImmutableList<BadgeView> Badges(JournalState journal) =>
        journal.Badges.Select(b => new BadgeView(b.Icon, b.Name, b.Description, $"{b.Value} / {b.Target}", b.Unlocked)).ToImmutableList();

    public static ImmutableList<LedgerView> Ledger(JournalState journal) =>
        journal.Ledger.Select(e => new LedgerView(e.Reason, e.Date, $"{(e.Amount > 0 ? "+" : "")}{e.Amount} ✦", e.Amount > 0)).ToImmutableList();

    public static ImmutableList<ColorView> Colors(ProfileState profile, string selected) =>
        profile.Colors.Select(c => new ColorView(c.Hex, c.Name, c.Hex == selected)).ToImmutableList();

    // The outfit with one part changed (Field is the game's outfit key).
    public static Outfit With(Outfit outfit, string field, string id) => field switch
    {
        "hair" => outfit with { Hair = id },
        "top" => outfit with { Top = id },
        "bottom" => outfit with { Bottom = id },
        "hairColor" => outfit with { HairColor = id },
        "topColor" => outfit with { TopColor = id },
        "bottomColor" => outfit with { BottomColor = id },
        "skin" => outfit with { Skin = id },
        _ => outfit,
    };

    public static string Part(Outfit outfit, string field) => field switch
    {
        "hair" => outfit.Hair,
        "top" => outfit.Top,
        "bottom" => outfit.Bottom,
        "hairColor" => outfit.HairColor,
        "topColor" => outfit.TopColor,
        "bottomColor" => outfit.BottomColor,
        "skin" => outfit.Skin,
        _ => "",
    };

    public static ImmutableList<ChoiceView> Choices(string field, ImmutableList<OutfitOption> options, Outfit outfit, bool swatch) =>
        options.Select(o => new ChoiceView(field, o.Id, o.Name, swatch ? o.Hex : "", Part(outfit, field) == o.Id)).ToImmutableList();
}
