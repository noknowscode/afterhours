using System.Collections.Immutable;

namespace Afterhours.Uno.Services;

// Shapes of the events game/host.mjs sends. Property names match its camelCase JSON.

public sealed partial record PublicRoom(int Index, string Title, string Owner, string Mood, int Count, string Icon, string Tag)
{
    public string Detail => $"{Mood} · {Count}";
}

public sealed partial record Hud(
    int Coins, string Name, int Level, int Xp, int XpLower, int XpUpper, int QuestsReady,
    string NextQuest, string NextQuestDetail, bool DailyClaimed, string DailyLabel, string ChatColor)
{
    public string LevelLabel => $"LEVEL {Level:00}";
    public string XpLabel => $"{Xp} XP";
    public double XpProgress => XpUpper > XpLower ? Math.Clamp((double)(Xp - XpLower) / (XpUpper - XpLower), 0, 1) : 0;
    public bool HasQuestsReady => QuestsReady > 0;
}

public sealed partial record Portrait(string Png);

public sealed partial record RoomInfo(string Key, string Title, string Eyebrow, string Meta, int Guests, bool Saved, bool Personal, int Index)
{
    public string SaveLabel => Saved ? "Saved" : "Save";
    public string DisplayTitle => Title.ToUpperInvariant();
}

public sealed partial record EditorState(bool Active, string Title, string Hint, bool CanRotate, bool CanStore, bool CanUndo);

public sealed partial record ActionState(bool Dancing, bool Seated)
{
    public string DanceLabel => Dancing ? "Stop dancing" : "Dance";
}

public sealed partial record NowPlaying(string Title, string Subtitle, bool Playing, double Progress, string Time)
{
    public string PlayLabel => Playing ? "Pause music" : "Play music";
    public string PlayGlyph => Playing ? "Ⅱ" : "▶";
}

public sealed partial record Connection(string Label, bool Connected);

public sealed partial record Chrome(RoomInfo Room, EditorState Editor, ActionState Actions, NowPlaying NowPlaying, Connection Connection);

public sealed partial record ChatLine(bool System, string Name, string Text, string Color);

public sealed partial record WhisperTarget(string Id, string Name);

public sealed partial record ChatState(ImmutableList<ChatLine> Lines, ImmutableList<WhisperTarget> WhisperTargets);

public sealed partial record ReadyEvent(int Scripts, ImmutableList<PublicRoom> PublicRooms);

public sealed partial record BridgeStatus(bool Ready);
