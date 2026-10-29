using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Your circle of residents and, when connected, friend requests and friends you can follow.
public partial record FriendsModel(ISocial Social, INavigator Navigator)
{
    public IFeed<SocialState> World => Feed.AsyncEnumerable(Social.WatchSocial);

    public IListFeed<CircleCard> Circle => World.Select(s => (IImmutableList<CircleCard>)SocialRules.Circle(s)).AsListFeed();

    public IFeed<bool> NoCircle => World.Select(s => (s.Circle ?? []).IsEmpty);

    public IFeed<bool> Connected => World.Select(s => s.Connected);

    public IListFeed<PersonRef> Requests => World.Select(s => (IImmutableList<PersonRef>)(s.Requests ?? [])).AsListFeed();

    public IListFeed<PlayerCard> Friends => World.Select(s => (IImmutableList<PlayerCard>)SocialRules.Friends(s)).AsListFeed();

    public IFeed<bool> NoFriends => World.Select(s => s.Connected && (s.Friends ?? []).IsEmpty && (s.Requests ?? []).IsEmpty);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask View(CircleCard resident, CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            Social.OpenResident(resident.Name);
    }

    public async ValueTask Accept(PersonRef person, CancellationToken ct) => await Run(Social.Act("accept", person.Id), ct);

    public async ValueTask Decline(PersonRef person, CancellationToken ct) => await Run(Social.Act("decline", person.Id), ct);

    public async ValueTask Remove(PlayerCard friend, CancellationToken ct) => await Run(Social.Act("unfriend", friend.Id), ct);

    public async ValueTask Follow(PlayerCard friend, CancellationToken ct)
    {
        if (await Run(Social.Act("follow", friend.Id), ct))
            await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask Sessions(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("sessions");
    }

    private async ValueTask<bool> Run(Task<SocialReply> act, CancellationToken ct)
    {
        var reply = await act;
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        return reply.Ok;
    }
}
