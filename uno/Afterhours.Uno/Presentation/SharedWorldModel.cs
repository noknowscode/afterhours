using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The shared world: the service is unavailable (check again), or you are connected (who is here, doors, trades,
// your account, the way back to solo). Joining is still a game panel.
public partial record SharedWorldModel(ISocial Social, INavigator Navigator)
{
    public IFeed<SocialState> World => Feed.AsyncEnumerable(Social.WatchSocial);

    public IFeed<WorldMode> Mode => World.Select(s => SocialRules.Mode(s));

    public IFeed<string> Banner => World.Select(s => SocialRules.Banner(s));

    public IListFeed<PlayerCard> Peers => World.Select(s => (IImmutableList<PlayerCard>)SocialRules.Peers(s)).AsListFeed();

    public IFeed<bool> NoPeers => World.Select(s => (s.Peers ?? []).IsEmpty);

    public IListFeed<PersonRef> Doors => World.Select(s => (IImmutableList<PersonRef>)(s.Doors ?? [])).AsListFeed();

    public IListFeed<TradeInvite> Invites => World.Select(s => (IImmutableList<TradeInvite>)SocialRules.Invites(s)).AsListFeed();

    public IFeed<bool> HasAccount => World.Select(s => s.Account is not null);

    public IFeed<string> AccountTitle => World.Select(s => s.Account is { } a ? SocialRules.AccountTitle(a) : "");

    public IFeed<string> AccountText => World.Select(s => s.Account is { } a ? SocialRules.AccountText(a) : "");

    public IFeed<bool> CanLink => World.Select(s => s.Account?.Anonymous == true);

    public IFeed<bool> InviteOnly => World.Select(s => s.Account is { Anonymous: true, InviteOnly: true });

    public IFeed<bool> CanSignOut => World.Select(s => s.Account?.Anonymous == false);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Retry(CancellationToken ct)
    {
        var reply = await Social.Act("retry");
        await Error.UpdateAsync(_ => reply.Ok ? "" : "The shared world is still out of reach.", ct);
    }

    // rooms, stage, friends, sessions (the join panel) or signOut: this sheet closes and the game opens the next one.
    public async ValueTask Open(string panel, CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act(panel);
    }

    public async ValueTask ViewPlayer(PlayerCard player, CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("player", player.Id);
    }

    public async ValueTask ViewTrade(TradeInvite trade, CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("openTrade", trade.Id);
    }

    public async ValueTask LetIn(PersonRef person, CancellationToken ct) => await Run(Social.Act("letIn", person.Id), ct);

    public async ValueTask Deny(PersonRef person, CancellationToken ct) => await Run(Social.Act("deny", person.Id), ct);

    public async ValueTask Link(CancellationToken ct) => await Run(Social.Act("link"), ct);

    public async ValueTask Leave(CancellationToken ct)
    {
        await Social.Act("leave");
        await Navigator.CloseSheetAsync(this, ct);
    }

    private async ValueTask Run(Task<SocialReply> act, CancellationToken ct)
    {
        var reply = await act;
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }
}
