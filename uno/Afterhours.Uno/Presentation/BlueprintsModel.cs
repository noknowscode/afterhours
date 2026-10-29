using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Saved room layouts: save the current room, or restore one (the game moves your pieces back).
public partial record BlueprintsModel(IGameStore Store, INavigator Navigator)
{
    public IFeed<Inventory> Inventory => Feed.AsyncEnumerable(Store.WatchInventory);

    public IListFeed<BlueprintView> Blueprints => Inventory
        .Select(i => (IImmutableList<BlueprintView>)i.Blueprints.Select(b => new BlueprintView(b.Id, b.Name, $"{b.Items.Count} pieces")).ToImmutableList())
        .AsListFeed();

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Save(CancellationToken ct)
    {
        var reply = Store.SaveBlueprint();
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }

    public async ValueTask Restore(BlueprintView blueprint, CancellationToken ct)
    {
        var reply = Store.RestoreBlueprint(blueprint.Id);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.CloseSheetAsync(this, ct);
    }
}
