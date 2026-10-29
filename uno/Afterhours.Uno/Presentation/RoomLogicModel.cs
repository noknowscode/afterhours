using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Room logic: "when this happens, do that" rules that run in your room while you are there (up to ten).
public partial record RoomLogicModel(IRooms Rooms)
{
    public IState<RoomState> Room => State.Value(this, Rooms.Room);

    public IListFeed<RuleView> Rules => Room.Select(r => (IImmutableList<RuleView>)RoomRules.Rules(r)).AsListFeed();

    public IReadOnlyList<Choice> Triggers => RoomRules.Triggers;

    public IReadOnlyList<Choice> Effects => RoomRules.Effects;

    public IState<string> Trigger => State.Value(this, () => "enter");

    public IState<string> Effect => State.Value(this, () => "lights");

    public IState<string> Phrase => State.Value(this, () => "");

    public IState<string> Message => State.Value(this, () => "");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Add(CancellationToken ct)
    {
        await Apply(Rooms.AddRule(await Trigger ?? "enter", await Effect ?? "lights", await Phrase ?? "", await Message ?? ""), ct);
        await Phrase.UpdateAsync(_ => "", ct);
        await Message.UpdateAsync(_ => "", ct);
    }

    public async ValueTask Remove(RuleView rule, CancellationToken ct) => await Apply(Rooms.DeleteRule(rule.Id), ct);

    private async ValueTask Apply(HostReply<RoomState> reply, CancellationToken ct)
    {
        if (reply.Ok && reply.Result is { } room)
            await Room.UpdateAsync(_ => room, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }
}
