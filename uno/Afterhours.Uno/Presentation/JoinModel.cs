using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Joining the shared world: a name, the security check when the world asks for one, and account recovery.
public partial record JoinModel(ISocial Social, INavigator Navigator)
{
    private readonly SocialState _opened = Social.Now();

    public bool Managed => _opened.Managed;

    public bool Unmanaged => !_opened.Managed;

    public bool NeedsCheck => SocialRules.NeedsCheck(_opened);

    public bool InviteOnly => _opened.Managed && _opened.Join?.InviteOnly == true;

    public string JoinLabel => SocialRules.JoinLabel(_opened);

    public IState<string> Name => State.Value(this, () => _opened.Join?.Name ?? "");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Join(CancellationToken ct)
    {
        await Error.UpdateAsync(_ => "", ct);
        var reply = await Social.Act("join", "", await Name ?? "");
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask Restore(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("restorePanel");
    }
}
