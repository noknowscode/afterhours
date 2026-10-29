using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The listening stage (solo open mic or the shared stage). The game keeps the countdown and the audience.
public partial record StageModel(IStage Stage, IRoomView RoomView, INavigator Navigator)
{
    public IFeed<StageView> Live => Feed.AsyncEnumerable(Stage.WatchStage);

    public IFeed<StageScreen> Screen => Live.Select(StageRules.Screen);

    public IListFeed<StageSong> Songs => Live.Select(s => (IImmutableList<StageSong>)s.Songs).AsListFeed();

    public IListFeed<StageEntry> Queue => Live.Select(s => (IImmutableList<StageEntry>)s.Queue).AsListFeed();

    public IState<string> Error => State<string>.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Join(StageSong song, CancellationToken ct) => await Report(Stage.Act("queue", song.Id), ct);

    public async ValueTask Leave(CancellationToken ct) => await Report(Stage.Act("leave"), ct);

    public async ValueTask Applaud(CancellationToken ct) => await Report(Stage.Act("applaud"), ct);

    public async ValueTask Listen(CancellationToken ct) => await Report(Stage.Act("listen"), ct);

    public async ValueTask BackToStage(CancellationToken ct) => await Report(Stage.Act("dismiss"), ct);

    public async ValueTask CollectRewards(CancellationToken ct)
    {
        Stage.Act("dismiss");
        if (await Navigator.CloseSheetAsync(this, ct))
            RoomView.Run("journal");
    }

    public async ValueTask MakeTrack(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            RoomView.Run("studio");
    }

    // The chart replaces the stage panel (as in the game), so drawers never stack.
    public async ValueTask OpenChart(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            Stage.Act("chart");
    }

    private async ValueTask Report(ActionReply reply, CancellationToken ct) => await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
}
