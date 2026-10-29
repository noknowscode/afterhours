using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// This week's shared-stage chart (and last week's top three), from the shared snapshot.
public partial record ChartModel(IStage Stage, INavigator Navigator)
{
    public IFeed<ChartView> Chart => Feed.AsyncEnumerable(Stage.WatchStage).Where(s => s.Chart is not null).Select(s => s.Chart!);

    public IListFeed<ChartRow> Top => Chart.Select(c => (IImmutableList<ChartRow>)c.Top).AsListFeed();

    public IListFeed<ChartRow> Last => Chart.Select(c => (IImmutableList<ChartRow>)c.Last).AsListFeed();

    public IFeed<bool> HasLast => Chart.Select(c => c.Last.Count > 0);

    public async ValueTask Back(CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        Stage.Act("open");
    }
}
