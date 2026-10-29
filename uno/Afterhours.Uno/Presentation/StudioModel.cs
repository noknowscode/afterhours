using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The beat studio and song library. The draft lives in the game; each edit replies with it, so this model keeps
// the latest reply as local state. Title, tempo, pack and length are two-way states that send only real changes.
public partial record StudioModel(IGameStore Store, IMusic Music, INavigator Navigator, StudioRequest Request)
{
    private readonly StudioState _opened = Store.Studio("get").Result ?? StudioRules.Blank;

    public ImmutableList<Choice> Packs => StudioRules.Packs;

    public ImmutableList<Choice> Lengths => StudioRules.Lengths;

    public IState<string> Tab => State.Value(this, () => Request.Tab);

    public IFeed<StudioTabs> Tabs => Tab.Select(tab => new StudioTabs(tab));

    public IState<StudioState> Studio => State.Value(this, () => _opened);

    public IState<string> Title => State.Value(this, () => _opened.Draft.Title).ForEach(SendTitle);

    public IState<double> Tempo => State.Value(this, () => (double)_opened.Draft.Bpm).ForEach(SendTempo);

    public IState<string> Pack => State.Value(this, () => _opened.Draft.Pack).ForEach(SendPack);

    public IState<string> Length => State.Value(this, () => $"{_opened.Draft.Length}").ForEach(SendLength);

    public IState<string> Error => State.Value(this, () => "");

    // The track waiting for a delete confirmation (the game asked inside its panel too).
    public IState<DeleteConfirm> Confirm => State.Value(this, () => DeleteConfirm.None);

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public IFeed<bool> CanUndo => Studio.Select(s => s.CanUndo);

    // Exactly Length cells per row, so the board wraps into the ruler and four lanes.
    public IFeed<double> BoardWidth => Studio.Select(s => s.Draft.Length * StudioRules.CellPitch);

    public IListFeed<StepCell> Ruler => Studio.Select(s => (IImmutableList<StepCell>)StudioRules.Ruler(s.Draft.Length)).AsListFeed();

    public IListFeed<StepCell> Cells => Studio.Select(s => (IImmutableList<StepCell>)StudioRules.Cells(s.Draft)).AsListFeed();

    public IListFeed<LaneView> Lanes => Studio.Select(s => (IImmutableList<LaneView>)StudioRules.Lanes(s.Draft)).AsListFeed();

    public IFeed<PlayState> Play => Feed.AsyncEnumerable(Music.WatchPlayback).Select(StudioRules.Play);

    public IListFeed<SongCard> Songs => Feed.AsyncEnumerable(Store.WatchSongs)
        .Select(songs => (IImmutableList<SongCard>)StudioRules.Library(songs)).AsListFeed();

    public IFeed<string> SongCount => Feed.AsyncEnumerable(Store.WatchSongs).Select(songs => $"{songs.Count} original {(songs.Count == 1 ? "track" : "tracks")} in your collection.");

    public async ValueTask ShowTab(string tab, CancellationToken ct)
    {
        await Tab.UpdateAsync(_ => tab, ct);
        await Error.UpdateAsync(_ => "", ct);
    }

    public async ValueTask ToggleStep(StepCell cell, CancellationToken ct)
    {
        if (cell.IsStep)
            await Apply(Store.Studio("step", cell.Row, cell.Col), ct);
    }

    public async ValueTask Mute(LaneView lane, CancellationToken ct) => await Apply(Store.Studio("mute", lane.Key), ct);

    public async ValueTask Solo(LaneView lane, CancellationToken ct) => await Apply(Store.Studio("solo", lane.Key), ct);

    // Called by the lane sliders (0–100) while they move.
    public async ValueTask SetVolume(int row, double volume, CancellationToken ct) => await Apply(Store.Studio("volume", row, volume / 100), ct);

    public async ValueTask Undo(CancellationToken ct) => await Replace(Store.Studio("undo"), ct);

    public async ValueTask Clear(CancellationToken ct) => await Apply(Store.Studio("clear"), ct);

    public async ValueTask NewTrack(CancellationToken ct) => await Replace(Store.Studio("new"), ct);

    public async ValueTask StartNewTrack(CancellationToken ct)
    {
        if (await Replace(Store.Studio("new"), ct))
            await ShowTab("editor", ct);
    }

    public async ValueTask SaveTrack(CancellationToken ct)
    {
        var title = await Title ?? "";
        if (await Apply(Store.StudioText("save", title), ct))
            await ShowTab("library", ct);
    }

    public ValueTask TogglePlay() => Report(Music.Play(null) ? null : "Your browser could not start audio. Try Play again.");

    public async ValueTask ExportWav() => await Report((await Music.ExportWav()).Error);

    public ValueTask PlaySong(SongCard song) => Report(Music.Play(song.Id) ? null : "This track is no longer in your library.");

    public async ValueTask EditSong(SongCard song, CancellationToken ct)
    {
        if (await Replace(Store.StudioText("edit", song.Id), ct))
            await ShowTab("editor", ct);
    }

    public async ValueTask Perform(SongCard song, CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            Store.Perform(song.Id);
    }

    public async ValueTask PressDisc(SongCard song, CancellationToken ct) => await Report(Store.PressDisc(song.Id).Error, ct);

    public async ValueTask DeleteSong(SongCard song, CancellationToken ct) => await Confirm.UpdateAsync(_ => new DeleteConfirm(song), ct);

    public async ValueTask ConfirmDelete(CancellationToken ct)
    {
        if ((await Confirm)?.Song is { } song)
            await Report(Store.DeleteSong(song.Id).Error, ct);
        await Confirm.UpdateAsync(_ => DeleteConfirm.None, ct);
    }

    public async ValueTask KeepSong(CancellationToken ct) => await Confirm.UpdateAsync(_ => DeleteConfirm.None, ct);

    // An edit's reply becomes the draft. False (with the game's message shown) when the game refused it.
    private async ValueTask<bool> Apply(StudioReply reply, CancellationToken ct)
    {
        if (reply.Result is { } result)
            await Studio.UpdateAsync(_ => result, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        return reply.Ok;
    }

    // Undo, new and edit swap the whole draft, so the two-way fields follow it.
    private async ValueTask<bool> Replace(StudioReply reply, CancellationToken ct)
    {
        if (!await Apply(reply, ct))
            return false;
        var draft = reply.Result!.Draft;
        await Title.UpdateAsync(_ => draft.Title, ct);
        await Tempo.UpdateAsync(_ => draft.Bpm, ct);
        await Pack.UpdateAsync(_ => draft.Pack, ct);
        await Length.UpdateAsync(_ => $"{draft.Length}", ct);
        return true;
    }

    private async ValueTask Report(string? error, CancellationToken ct = default) => await Error.UpdateAsync(_ => error ?? "", ct);

    // The two-way fields send only real changes, so seeding or following the draft never adds an undo step.
    private async ValueTask SendTitle(string? title, CancellationToken ct)
    {
        if (title is not null && title != (await Studio)?.Draft.Title)
            await Apply(Store.StudioText("title", title), ct);
    }

    private async ValueTask SendTempo(double bpm, CancellationToken ct)
    {
        if ((int)Math.Round(bpm) != (await Studio)?.Draft.Bpm)
            await Apply(Store.Studio("tempo", Math.Round(bpm)), ct);
    }

    private async ValueTask SendPack(string? pack, CancellationToken ct)
    {
        if (pack is not null && pack != (await Studio)?.Draft.Pack)
            await Apply(Store.StudioText("pack", pack), ct);
    }

    private async ValueTask SendLength(string? length, CancellationToken ct)
    {
        if (int.TryParse(length, out var steps) && steps != (await Studio)?.Draft.Length)
            await Apply(Store.Studio("length", steps), ct);
    }
}
