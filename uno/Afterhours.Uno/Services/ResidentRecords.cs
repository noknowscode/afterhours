using System.Collections.Immutable;

namespace Afterhours.Uno.Services;

// The resident's journal, profile and outfit as the game reports them (its own progress rules).

public sealed partial record HostReply<T>(bool Ok, string? Error, T? Result);

public sealed partial record QuestRow(string Id, string Name, string Description, int Value, int Target, int Xp, int Reward, bool Claimed);

public sealed partial record BadgeRow(string Id, string Name, string Description, string Icon, int Value, int Target, bool Unlocked);

public sealed partial record LedgerRow(string Reason, string Date, int Amount);

public sealed partial record JournalState(ImmutableList<QuestRow> Quests, ImmutableList<BadgeRow> Badges, int Coins, ImmutableList<LedgerRow> Ledger)
{
    public static JournalState Empty { get; } = new([], [], 0, []);
}

public sealed partial record BadgeChip(string Icon, string Name);

public sealed partial record ColorChoice(string Hex, string Name);

public sealed partial record ProfileState(string Name, string Motto, string ChatColor, int Level, int Xp, string Joined,
    ImmutableList<BadgeChip> Badges, ImmutableList<ColorChoice> Colors)
{
    public static ProfileState Empty { get; } = new("", "", "", 1, 0, "", [], []);
}

// What a save or backup would restore, shown before the player confirms.
public sealed partial record RestorePrompt(string Title, string Message, string Action);

public sealed partial record OutfitOption(string Id, string Name, string Hex);

public sealed partial record Outfit(int Version, string Hair, string Top, string Bottom, string HairColor, string TopColor, string BottomColor, string Skin);

public sealed partial record WardrobeState(ImmutableList<string> Presets, ImmutableList<OutfitOption> Hair, ImmutableList<OutfitOption> Tops,
    ImmutableList<OutfitOption> Bottoms, ImmutableList<OutfitOption> Colors, ImmutableList<OutfitOption> HairColors,
    ImmutableList<OutfitOption> SkinColors, Outfit Outfit, int Preset);
