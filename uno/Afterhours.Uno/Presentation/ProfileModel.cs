using System.Collections.Immutable;
using Afterhours.Uno.Services;
using Windows.Storage.Pickers;

namespace Afterhours.Uno.Presentation;

// The resident profile: name, motto and chat colour, keepsakes, and keeping or restoring a save.
public partial record ProfileModel(IResident Resident, IGameStore Store, IRoomView RoomView, INavigator Navigator)
{
    private readonly ProfileState _opened = Resident.Profile();

    public IState<ProfileState> Profile => State.Value(this, () => _opened);

    public IState<string> DisplayName => State.Value(this, () => _opened.Name);

    public IState<string> Motto => State.Value(this, () => _opened.Motto);

    public IState<string> ChatColor => State.Value(this, () => _opened.ChatColor);

    public IListFeed<ColorView> Colors => Feed.Combine(Profile, ChatColor)
        .Select(x => (IImmutableList<ColorView>)ResidentRules.Colors(x.Item1, x.Item2)).AsListFeed();

    public IListFeed<BadgeChip> Keepsakes => Profile.Select(p => (IImmutableList<BadgeChip>)p.Badges).AsListFeed();

    public IFeed<string> Summary => Profile.Select(p => $"Level {p.Level} · {p.Xp} XP · Here since {p.Joined}");

    public IFeed<Portrait> Portrait => Feed.AsyncEnumerable(Store.WatchPortrait);

    public IState<RestoreView> Restore => State.Value(this, () => RestoreView.None);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask PickColor(ColorView color, CancellationToken ct) => await ChatColor.UpdateAsync(_ => color.Hex, ct);

    public async ValueTask Save(CancellationToken ct)
    {
        var reply = Resident.SaveProfile(await DisplayName ?? "", await Motto ?? "", await ChatColor ?? "");
        if (reply.Result is { } profile)
            await Profile.UpdateAsync(_ => profile, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }

    public async ValueTask ChangeOutfit(CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        RoomView.Run("look");
    }

    public async ValueTask ExportSave(CancellationToken ct) => await Error.UpdateAsync(_ => Resident.ExportSave().Error ?? "", ct);

    public async ValueTask RestoreFile(CancellationToken ct)
    {
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".json");
        if (await picker.PickSingleFileAsync() is not { } file)
            return;
        await Ask(Resident.InspectSave(await FileIO.ReadTextAsync(file)), ct);
    }

    public async ValueTask UseBackup(CancellationToken ct) => await Ask(Resident.InspectBackup(), ct);

    public async ValueTask ConfirmRestore(CancellationToken ct)
    {
        var reply = Resident.ConfirmRestore();
        await Restore.UpdateAsync(_ => RestoreView.None, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.NavigateBackAsync(this, cancellation: ct);
    }

    public async ValueTask KeepWorld(CancellationToken ct) => await Restore.UpdateAsync(_ => RestoreView.None, ct);

    private async ValueTask Ask(HostReply<RestorePrompt> reply, CancellationToken ct)
    {
        await Restore.UpdateAsync(_ => new RestoreView(reply.Result), ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }
}
