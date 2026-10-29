using System.Collections.Immutable;
using System.Text.Json;
using Afterhours.Uno.Interop;

namespace Afterhours.Uno.Services;

// Phase A: both interfaces are backed by the JavaScript game running in the same page.
[System.Runtime.Versioning.SupportedOSPlatform("browser")]
public sealed class JsGame(GameEvents events) : IGameStore, IRoomView, IMusic
{
    private static readonly TimeSpan OpenTimeout = TimeSpan.FromSeconds(15);
    private bool _mounted;

    public IAsyncEnumerable<Hud> WatchHud(CancellationToken ct) => events.Hud.Watch(ct);

    public IAsyncEnumerable<Portrait> WatchPortrait(CancellationToken ct) => events.Portrait.Watch(ct);

    public bool TryGetSlice(string key, out JsonElement value) => events.TryGetSlice(key, out value);

    public IAsyncEnumerable<BridgeStatus> WatchStatus(CancellationToken ct) => events.Status.Watch(ct);

    public IAsyncEnumerable<ImmutableList<PublicRoom>> WatchPublicRooms(CancellationToken ct) => events.PublicRooms.Watch(ct);

    public IAsyncEnumerable<Chrome> WatchChrome(CancellationToken ct) => events.Chrome.Watch(ct);

    public IAsyncEnumerable<ChatState> WatchChat(CancellationToken ct) => events.Chat.Watch(ct);

    public IAsyncEnumerable<OpenRequest> WatchOpenRequests(CancellationToken ct) => events.OpenRequests.Watch(ct);

    public IAsyncEnumerable<ShopData> WatchShop(CancellationToken ct) => events.Shop.Watch(ct);

    public IAsyncEnumerable<Inventory> WatchInventory(CancellationToken ct) => events.Inventory.Watch(ct);

    public ActionReply Buy(string type) => Reply(() => GameHost.Buy(type));

    public async Task<ActionReply> Place(string itemId) => _mounted ? Parse(await GameHost.Place(itemId)) : ActionReply.NotReady;

    public ActionReply Use(string itemId) => Reply(() => GameHost.Use(itemId));

    public ActionReply Wrap(string giftId, string contentId, string note) => Reply(() => GameHost.Wrap(giftId, contentId, note));

    public ActionReply SaveBlueprint() => Reply(GameHost.SaveBlueprint);

    public ActionReply RestoreBlueprint(string blueprintId) => Reply(() => GameHost.RestoreBlueprint(blueprintId));

    public ActionReply PlayDisc(string discId) => Reply(() => GameHost.PlayDisc(discId));

    public IAsyncEnumerable<ImmutableList<Song>> WatchSongs(CancellationToken ct) => events.Songs.Watch(ct);

    public StudioReply Studio(string op, double a = 0, double b = 0) => StudioReply(() => GameHost.Studio(op, a, b));

    public StudioReply StudioText(string op, string text) => StudioReply(() => GameHost.StudioText(op, text));

    public ActionReply PressDisc(string songId) => Reply(() => GameHost.PressDisc(songId));

    public ActionReply DeleteSong(string songId) => Reply(() => GameHost.DeleteSong(songId));

    public ActionReply Perform(string songId) => Reply(() => GameHost.Perform(songId));

    public ActionReply SavePlaylist(IEnumerable<string> songIds) => Reply(() => GameHost.SavePlaylist(Ids(songIds)));

    public IAsyncEnumerable<Playback> WatchPlayback(CancellationToken ct) => events.Playback.Watch(ct);

    public bool Play(string? songId) => _mounted && Parse(GameHost.PlayTrack(songId ?? "")).Ok;

    public async Task<ActionReply> ExportWav() => _mounted ? Parse(await GameHost.ExportWav()) : ActionReply.NotReady;

    public ActionReply PlayPlaylist(IEnumerable<string> songIds) => Reply(() => GameHost.PlayPlaylist(Ids(songIds)));

    private static string Ids(IEnumerable<string> ids) => JsonSerializer.Serialize(ids.ToImmutableList(), BridgeJsonContext.Default.ImmutableListString);

    private StudioReply StudioReply(Func<string> call) =>
        _mounted ? JsonSerializer.Deserialize(call(), BridgeJsonContext.Default.StudioReply)! : Services.StudioReply.NotReady;

    private ActionReply Reply(Func<string> call) => _mounted ? Parse(call()) : ActionReply.NotReady;

    private static ActionReply Parse(string json) => JsonSerializer.Deserialize(json, BridgeJsonContext.Default.ActionReply)!;

    public async Task MountAsync(string elementId)
    {
        if (_mounted)
            return;
        _mounted = true;
        try
        {
            var url = global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("new URL('game/host.mjs', document.baseURI).href");
            await GameHost.ImportAsync(url);
            var mount = GameHost.Mount(elementId, events.Receive);
            if (await Task.WhenAny(mount, Task.Delay(OpenTimeout)) != mount)
                throw new TimeoutException("Your world took too long to open.");
            await mount;
        }
        catch (Exception e)
        {
            events.Fail(e);
        }
    }

    public bool Run(string command) => _mounted && GameHost.Invoke(command);

    public bool Travel(int index) => _mounted && GameHost.Travel(index);

    public bool Say(string text, string mode, string? target) => _mounted && GameHost.Say(text, mode, target ?? "");

    public void Focus()
    {
        if (_mounted)
            GameHost.FocusRoom();
    }

    public void Reload() => global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("location.reload()");
}
