using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The arcade picker. A round and its results are game panels, so the sheet closes when one starts.
public partial record ArcadeModel(IResident Resident, INavigator Navigator)
{
    public ImmutableList<ArcadeCard> Games { get; } = RoomRules.Arcade(Resident.Arcade());

    public async ValueTask Play(ArcadeCard game, CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        Resident.PlayArcade(game.Id);
    }
}
