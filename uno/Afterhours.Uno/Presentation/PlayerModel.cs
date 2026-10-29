using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// A connected player: friend, trade, whisper, block, report, and in your own room remove or ban.
public partial record PlayerModel(ISocial Social, IRoomView RoomView, INavigator Navigator, PlayerRequest Request)
{
    public IFeed<SocialState> World => Feed.AsyncEnumerable(Social.WatchSocial);

    public IFeed<Player> Player => World.Select(s => SocialRules.Player(s, Request.Id) ?? new(Request.Id, "", 1, "", false, "Offline"));

    public IFeed<string> Detail => Player.Select(p => $"Level {p.Level} · {(p.Online ? "Here tonight" : "Offline")}");

    public IFeed<bool> InOwnRoom => World.Select(s => s.InOwnRoom);

    public IState<ReportView> Report => State.Value(this, () => ReportView.Closed);

    public IState<string> Reason => State.Value(this, () => "");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask AddFriend(CancellationToken ct) => await Run(Social.Act("friend", Request.Id), ct);

    public async ValueTask Trade(CancellationToken ct)
    {
        var reply = await Social.Act("trade", Request.Id);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok && reply.Result is { } trade && await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("openTrade", trade);
    }

    public async ValueTask Whisper(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            RoomView.WhisperTo(Request.Id);
    }

    public async ValueTask Block(CancellationToken ct) => await RunAndClose(Social.Act("block", Request.Id), ct);

    public async ValueTask OpenReport(CancellationToken ct) => await Report.UpdateAsync(_ => new ReportView(true), ct);

    public async ValueTask SubmitReport(CancellationToken ct) => await RunAndClose(Social.Act("report", Request.Id, await Reason ?? ""), ct);

    public async ValueTask Kick(CancellationToken ct) => await RunAndClose(Social.Act("kick", Request.Id), ct);

    public async ValueTask Ban(CancellationToken ct) => await RunAndClose(Social.Act("ban", Request.Id), ct);

    private async ValueTask<bool> Run(Task<SocialReply> act, CancellationToken ct)
    {
        var reply = await act;
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        return reply.Ok;
    }

    private async ValueTask RunAndClose(Task<SocialReply> act, CancellationToken ct)
    {
        if (await Run(act, ct))
            await Navigator.CloseSheetAsync(this, ct);
    }
}
