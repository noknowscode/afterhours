using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// What happened in the shared world since your last visit (shown once when you join).
public partial record AwayModel(ISocial Social, INavigator Navigator)
{
    public IFeed<SocialState> World => Feed.AsyncEnumerable(Social.WatchSocial);

    public IListFeed<AwayItem> Items => World.Select(s => (IImmutableList<AwayItem>)(s.Away ?? [])).AsListFeed();

    public IFeed<string> More => World.Select(s => s.AwayMore > 0 ? $"and {s.AwayMore} more" : "");

    public async ValueTask Done(CancellationToken ct)
    {
        await Social.Act("awaySeen");
        await Navigator.CloseSheetAsync(this, ct);
    }
}
