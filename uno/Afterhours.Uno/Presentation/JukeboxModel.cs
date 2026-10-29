using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The room jukebox: pick songs for the current room's playlist, save it, or save and play it.
public partial record JukeboxModel(IGameStore Store, IMusic Music, INavigator Navigator)
{
    public IFeed<ImmutableList<Song>> Library => Feed.AsyncEnumerable(Store.WatchSongs);

    // Starts from the room's saved playlist; ticking a song changes only this panel until Save.
    public IState<ImmutableHashSet<string>> Chosen => State.Async(this, async ct =>
    {
        await foreach (var inventory in Store.WatchInventory(ct))
            return (inventory.Rooms.FirstOrDefault(r => r.Id == inventory.ActiveRoom)?.Playlist ?? []).ToImmutableHashSet();
        return [];
    });

    public IListFeed<JukeboxOption> Options => Feed.Combine(Library, Chosen)
        .Select(x => (IImmutableList<JukeboxOption>)StudioRules.Jukebox(x.Item1, x.Item2)).AsListFeed();

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Toggle(JukeboxOption option, CancellationToken ct) =>
        await Chosen.UpdateAsync(set => set is null ? [option.Id] : set.Contains(option.Id) ? set.Remove(option.Id) : set.Add(option.Id), ct);

    public async ValueTask Save(CancellationToken ct)
    {
        var reply = Store.SavePlaylist(await Playlist());
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask PlayAll(CancellationToken ct)
    {
        var reply = Music.PlayPlaylist(await Playlist());
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }

    // The chosen songs in library order (the order the jukebox plays them).
    private async ValueTask<ImmutableList<string>> Playlist() =>
        (await Options)?.Where(o => o.Chosen).Select(o => o.Id).ToImmutableList() ?? [];
}
