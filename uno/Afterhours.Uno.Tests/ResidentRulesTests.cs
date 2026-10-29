using Afterhours.Uno.Presentation;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Tests;

public class ResidentRulesTests
{
    private static readonly JournalState Journal = new(
        [new("hello", "Your first hello", "Say something.", 1, 1, 20, 20, true),
         new("pressing", "First pressing", "Save a track.", 1, 1, 40, 45, false),
         new("rooms", "Find your frequency", "Visit all four rooms.", 2, 4, 50, 60, false)],
        [new("owl", "Night owl", "Stay late.", "☾", 1, 1, true), new("artist", "Original artist", "Save three songs.", "♫", 1, 3, false)],
        425, [new("Daily check-in", "10/29/2026", 35), new("Pressed Side B", "10/29/2026", -10)]);

    [Fact]
    public void Quests_mark_collected_ready_and_in_progress_like_the_game()
    {
        var quests = ResidentRules.Quests(Journal);
        Assert.Equal(["✓", "✦", "○"], quests.Select(q => q.Mark));
        Assert.Equal(["Collected", "45 ✦", "60 ✦"], quests.Select(q => q.Action));
        Assert.Equal([false, true, false], quests.Select(q => q.CanClaim));
        Assert.Equal(50, quests[2].Percent);
        Assert.Equal("2 / 4 · 50 XP", quests[2].Counts);
    }

    [Fact]
    public void Badges_fade_until_unlocked_and_the_ledger_signs_amounts()
    {
        var badges = ResidentRules.Badges(Journal);
        Assert.Equal([1, 0.45], badges.Select(b => b.Fade));
        Assert.Equal("Original artist, 1 / 3", badges[1].ToString());
        Assert.Equal(["+35 ✦", "-10 ✦"], ResidentRules.Ledger(Journal).Select(l => l.Amount));
    }

    [Fact]
    public void Wardrobe_choices_follow_the_outfit()
    {
        var outfit = new Outfit(1, "crop", "hoodie", "cargo", "chestnut", "moss", "ink", "sand");
        var bob = ResidentRules.With(outfit, "hair", "bob");
        Assert.Equal("bob", bob.Hair);
        Assert.Equal(outfit with { Hair = "bob" }, bob);
        Assert.Equal(outfit, ResidentRules.With(outfit, "unknown", "x"));
        var options = ResidentRules.Choices("hairColor", [new("chestnut", "Chestnut", "#8a4f33"), new("silver", "Silver", "#b6bac5")], outfit, swatch: true);
        Assert.Equal([true, false], options.Select(o => o.Selected));
        Assert.All(options, o => Assert.True(o.IsSwatch));
        Assert.False(ResidentRules.Choices("hair", [new("crop", "Tousled crop", "")], outfit, swatch: false)[0].IsSwatch);
    }

    [Fact]
    public void Chat_colours_mark_the_chosen_one()
    {
        var profile = ProfileState.Empty with { Colors = [new("#c8102e", "Cherry"), new("#0f7a6c", "Teal")] };
        Assert.Equal([false, true], ResidentRules.Colors(profile, "#0f7a6c").Select(c => c.Selected));
    }
}
