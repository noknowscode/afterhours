using System.Collections.Immutable;
using System.Text.Json;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// A furniture trade with another player: accept the invitation, choose up to eight pieces, confirm or cancel.
// The service keeps the trade; both players' sheets follow it as it changes.
public partial record TradeModel(ISocial Social, IRoomView RoomView, INavigator Navigator, TradeRequest Request)
{
    public IFeed<SocialState> World => Feed.AsyncEnumerable(Social.WatchSocial);

    // A trade that is gone reads as closed.
    public IFeed<Trade> Trade => World.Select(s => SocialRules.Trade(s, Request.Id)
        ?? new(Request.Id, "cancelled", "", false, false, false, true, false, false, [], []));

    public IFeed<string> Title => Trade.Select(t => SocialRules.TradeTitle(t));

    public IFeed<string> Note => Trade.Select(t => SocialRules.TradeNote(t));

    public IListFeed<SideView> Sides => Trade.Select(t => (IImmutableList<SideView>)SocialRules.Sides(t)).AsListFeed();

    // No ids until you change your picks; then your picks win until you send them.
    public IState<PickedPieces> Picked => State.Value(this, () => PickedPieces.None);

    public IListFeed<PieceView> Pieces => Feed.Combine(Trade, Picked)
        .Select(x => (IImmutableList<PieceView>)SocialRules.Pieces(x.Item1, x.Item2.Ids)).AsListFeed();

    public IFeed<string> ConfirmLabel => Trade.Select(t => t.Confirmed ? "Confirmed · waiting" : "Confirm this exchange");

    public IFeed<bool> CanConfirm => Trade.Select(t => !t.Confirmed);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Toggle(PieceView piece, CancellationToken ct)
    {
        var trade = await Trade;
        var picked = await Picked;
        await Picked.UpdateAsync(_ => new PickedPieces(SocialRules.Toggle(trade, picked?.Ids, piece.Id)), ct);
    }

    public async ValueTask Accept(CancellationToken ct) => await Run(Social.Act("tradeAccept", Request.Id), ct);

    public async ValueTask UpdateOffer(CancellationToken ct)
    {
        var ids = (await Pieces ?? []).Where(p => p.Offered).Select(p => p.Id).ToImmutableList();
        if (await Run(Social.Act("tradeOffer", Request.Id, JsonSerializer.Serialize(ids, Services.BridgeJsonContext.Default.ImmutableListString)), ct))
            await Picked.UpdateAsync(_ => PickedPieces.None, ct);
    }

    public async ValueTask Confirm(CancellationToken ct) => await Run(Social.Act("tradeConfirm", Request.Id), ct);

    public async ValueTask Cancel(CancellationToken ct) => await Run(Social.Act("tradeCancel", Request.Id), ct);

    public async ValueTask OpenInventory(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            RoomView.Run("inventory");
    }

    private async ValueTask<bool> Run(Task<SocialReply> act, CancellationToken ct)
    {
        var reply = await act;
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        return reply.Ok;
    }
}
