using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// What the stage panel shows for one StageView: the game's own copy for solo and shared, and which parts are on.
public sealed partial record StageScreen(StageView Stage)
{
    public bool IsShared => Stage.Mode == "shared";
    public bool IsComplete => Stage.Complete is not null && Stage.Current is null;
    public string Eyebrow => IsComplete ? "SET COMPLETE" : IsShared ? "SHARED MUSIC STAGE" : "THE LISTENING STAGE";
    public string Title => IsComplete ? "You found your frequency" : IsShared ? "The room is listening" : "Your moment on Side B";
    public bool ShowIntro => !IsShared && !IsComplete;

    public bool HasCurrent => Stage.Current is not null;
    public string Phase => Stage.Current?.Phase ?? "";
    public string SongTitle => Stage.Current?.Title ?? "";
    public string Countdown => Stage.Current is not { } now ? ""
        : IsShared ? $"by {now.Artist} · {now.Remaining}s remaining"
        : $"{now.Remaining}s {(now.Started ? "remaining" : "until your set")}";
    public double Progress => (Stage.Current?.Progress ?? 0) * 100;
    public string Applause => $"{Stage.Current?.Applause ?? 0} applause";
    public bool ShowSharedNow => IsShared && HasCurrent;
    public string ListenLabel => Stage.Listening ? "Ⅱ Mute stage" : "▶ Listen together";
    public string ApplaudLabel => Stage.Performing ? "Your performance" : Stage.Applauded ? "Applauded ✓" : "♡ Applaud";
    public bool ShowOpenStage => IsShared && !HasCurrent;

    public bool ShowQueue => IsShared && Stage.Queue.Count > 0;
    public bool ShowLeave => Stage.Own;
    public bool ShowLineup => !IsShared && !Stage.Own && !IsComplete;
    public bool ShowPicker => !Stage.Own && !IsComplete && Stage.Songs.Count > 0;
    public bool ShowNoSongs => !Stage.Own && !IsComplete && Stage.Songs.Count == 0;
    public string PickLabel => IsShared ? "Join queue ↗" : "Join stage ↗";

    public string Reward => Stage.Complete is { Credits: > 0 } done ? $"+{done.Credits} credits" : "Set complete";
    public string RewardDetail => Stage.Complete is { } done ? $"“{done.Title}” · {done.Applause} resident reactions" : "";
}

public static class StageRules
{
    public static StageScreen Screen(StageView stage) => new(stage);
}
