using System.Collections.Immutable;

namespace Afterhours.Uno.Services;

// The stage as the game sends it: solo (resident audience) or shared (real players and the weekly chart).

public sealed partial record StageNow(string Title, string Artist, string Phase, int Remaining, double Progress, int Applause, bool Started);

public sealed partial record StageEntry(string Title, string Artist);

public sealed partial record StageSong(string Id, string Title, string Detail)
{
    public override string ToString() => Title;
}

public sealed partial record ChartRow(string Mark, string Title, string Artist, int Listeners, bool Own)
{
    public override string ToString() => $"{Mark}. {Title} by {Artist}";
}

public sealed partial record ChartView(string Week, ImmutableList<ChartRow> Top, ImmutableList<ChartRow> Last);

public sealed partial record SetResult(int Credits, string Title, int Applause);

public sealed partial record StageView(
    string Mode, StageNow? Current, ImmutableList<StageEntry> Queue, bool Own, bool Performing,
    bool CanApplaud, bool Applauded, bool Listening, ImmutableList<StageSong> Songs, ChartView? Chart, SetResult? Complete, string Note)
{
    public static StageView Closed { get; } = new("solo", null, [], false, false, false, false, false, [], null, null, "");
}
