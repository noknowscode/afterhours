using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The companion: adopt one, then feed, play, train, and ask for the tricks it has learned.
public partial record CompanionModel(IResident Resident, INavigator Navigator)
{
    public string Portrait { get; } = Resident.PetPortrait();

    public IState<PetState> Pet => State.Value(this, Resident.Companion);

    public IFeed<bool> HasPet => Pet.Select(p => p.Pet is not null);

    public IFeed<bool> NoPet => Pet.Select(p => p.Pet is null);

    public IFeed<string> Title => Pet.Select(p => p.Pet?.Name ?? "A little company");

    public IFeed<string> Eyebrow => Pet.Select(p => p.Pet is null ? "ADOPT A COMPANION" : "YOUR COMPANION");

    public IListFeed<NeedView> Needs => Pet.Select(p => (IImmutableList<NeedView>)(p.Pet is { } pet ? RoomRules.Needs(pet) : [])).AsListFeed();

    public IListFeed<TrickView> Tricks => Pet.Select(p => (IImmutableList<TrickView>)(p.Pet is { } pet ? RoomRules.Tricks(pet) : [])).AsListFeed();

    public IFeed<string> Training => Pet.Select(p => p.Pet is { } pet ? RoomRules.Training(pet) : "");

    public IFeed<string> FollowLabel => Pet.Select(p => p.Pet?.Following == true ? "Stay here" : "Follow me");

    public IState<string> Name => State.Value(this, () => "Biscuit");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Adopt(CancellationToken ct) => await Apply(Resident.AdoptPet(await Name ?? ""), ct);

    // feed, play, train or follow.
    public async ValueTask Care(string action, CancellationToken ct) => await Apply(Resident.PetAction(action), ct);

    // A trick plays out in the room, so the sheet closes.
    public async ValueTask Perform(TrickView trick, CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            Resident.PetAction(trick.Id);
    }

    private async ValueTask Apply(HostReply<PetState> reply, CancellationToken ct)
    {
        if (reply.Result is { } pet)
            await Pet.UpdateAsync(_ => pet, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }
}
