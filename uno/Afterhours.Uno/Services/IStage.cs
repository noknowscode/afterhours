namespace Afterhours.Uno.Services;

// The listening stage: the solo open mic, or the shared stage when connected. The game keeps its timing.
public interface IStage
{
    // While anyone watches, the game sends the stage as it changes and knows its panel is open.
    IAsyncEnumerable<StageView> WatchStage(CancellationToken ct);

    // queue (a song id), leave, applaud, listen (toggle), dismiss (the finished set), chart and open (ask the game
    // for the chart or stage panel).
    ActionReply Act(string op, string songId = "");
}
