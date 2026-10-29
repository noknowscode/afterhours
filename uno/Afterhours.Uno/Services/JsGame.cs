using System.Collections.Immutable;
using System.Text.Json;
using Afterhours.Uno.Interop;

namespace Afterhours.Uno.Services;

// Phase A: both interfaces are backed by the JavaScript game running in the same page.
[System.Runtime.Versioning.SupportedOSPlatform("browser")]
public sealed class JsGame(GameEvents events) : IGameStore, IRoomView, IMusic, IStage, IResident, IRooms
{
    private static readonly TimeSpan OpenTimeout = TimeSpan.FromSeconds(15);
    private bool _mounted;
    private int _stageWatchers;

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

    public async IAsyncEnumerable<StageView> WatchStage([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        if (_mounted && ++_stageWatchers == 1)
            GameHost.StageWatch(true);
        try
        {
            await foreach (var stage in events.Stage.Watch(ct))
                yield return stage;
        }
        finally
        {
            if (_mounted && --_stageWatchers == 0)
                GameHost.StageWatch(false);
        }
    }

    public ActionReply Act(string op, string songId = "") => Reply(() => GameHost.Stage(op, songId));

    public JournalState Journal() => Host(GameHost.Journal, Ctx.HostReplyJournalState)?.Result ?? JournalState.Empty;

    public HostReply<JournalState> ClaimQuest(string questId) => Host(() => GameHost.ClaimQuest(questId), Ctx.HostReplyJournalState) ?? new(false, NotReady, null);

    public ProfileState Profile() => Host(GameHost.Profile, Ctx.HostReplyProfileState)?.Result ?? ProfileState.Empty;

    public HostReply<ProfileState> SaveProfile(string name, string motto, string chatColor) =>
        Host(() => GameHost.SaveProfile(name, motto, chatColor), Ctx.HostReplyProfileState) ?? new(false, NotReady, null);

    public ActionReply ExportSave() => Reply(GameHost.ExportSave);

    public HostReply<RestorePrompt> InspectSave(string text) => Host(() => GameHost.InspectSave(text), Ctx.HostReplyRestorePrompt) ?? new(false, NotReady, null);

    public HostReply<RestorePrompt> InspectBackup() => Host(GameHost.InspectBackup, Ctx.HostReplyRestorePrompt) ?? new(false, NotReady, null);

    public ActionReply ConfirmRestore() => Reply(GameHost.ConfirmRestore);

    public WardrobeState? Wardrobe() => Host(GameHost.Wardrobe, Ctx.HostReplyWardrobeState)?.Result;

    public Outfit PresetOutfit(int index) => JsonSerializer.Deserialize(GameHost.PresetOutfit(index), Ctx.Outfit)!;

    public async Task<string> RenderOutfit(Outfit outfit, string pose, bool portrait = false) =>
        _mounted ? await GameHost.OutfitPreview(JsonSerializer.Serialize(outfit, Ctx.Outfit), pose, portrait) : "";

    public ActionReply SaveLook(Outfit outfit, int preset) => Reply(() => GameHost.SaveLook(JsonSerializer.Serialize(outfit, Ctx.Outfit), preset));

    public void ClassicLook()
    {
        if (_mounted)
            GameHost.ClassicLook();
    }

    public RoomsState Rooms() => Host(GameHost.Rooms, Ctx.HostReplyRoomsState)?.Result ?? RoomsState.Empty;

    public async Task<ActionReply> GoTo(string key) => _mounted ? Parse(await GameHost.GoToRoom(key)) : ActionReply.NotReady;

    public ActionReply CreateRoom(string name, string description, string tags) => Reply(() => GameHost.CreateRoom(name, description, tags));

    public RoomState Room() => Host(GameHost.Room, Ctx.HostReplyRoomState)?.Result ?? RoomState.Empty;

    public void OpenRoomPanel(string name)
    {
        if (_mounted)
            GameHost.RoomPanel(name);
    }

    public HostReply<RoomState> SaveSettings(string name, string description, string tags, string lighting, string door) =>
        RoomReply(() => GameHost.SaveRoomSettings(name, description, tags, lighting, door));

    public HostReply<RoomState> AddNote(string text) => RoomReply(() => GameHost.AddNote(text));

    public HostReply<RoomState> DeleteNote(string noteId) => RoomReply(() => GameHost.DeleteNote(noteId));

    public HostReply<RoomState> AddRule(string trigger, string effect, string phrase, string message) =>
        RoomReply(() => GameHost.AddRule(trigger, effect, phrase, message));

    public HostReply<RoomState> DeleteRule(string ruleId) => RoomReply(() => GameHost.DeleteRule(ruleId));

    public HostReply<RoomState> HostEvent(string name, int delay) => RoomReply(() => GameHost.HostEvent(name, delay));

    public HostReply<RoomState> EndEvent() => RoomReply(GameHost.EndEvent);

    public ActionReply LinkPortal(string itemId, string roomId) => Reply(() => GameHost.LinkPortal(itemId, roomId));

    public RoomObject? Object() => Host(GameHost.RoomObject, Ctx.HostReplyRoomObject)?.Result;

    public ActionReply ObjectAction(int index) => Reply(() => GameHost.ObjectAction(index));

    public ActionReply MoveObject() => Reply(GameHost.ObjectMove);

    public ArcadeState Arcade() => Host(GameHost.Arcade, Ctx.HostReplyArcadeState)?.Result ?? new([]);

    public void PlayArcade(string kind)
    {
        if (_mounted)
            GameHost.PlayArcade(kind);
    }

    public PetState Companion() => Host(GameHost.Pet, Ctx.HostReplyPetState)?.Result ?? PetState.None;

    public HostReply<PetState> AdoptPet(string name) => Host(() => GameHost.AdoptPet(name), Ctx.HostReplyPetState) ?? new(false, NotReady, null);

    public HostReply<PetState> PetAction(string action) => Host(() => GameHost.PetAction(action), Ctx.HostReplyPetState) ?? new(false, NotReady, null);

    public string PetPortrait() => _mounted ? GameHost.PetPortrait() : "";

    private HostReply<RoomState> RoomReply(Func<string> call) => Host(call, Ctx.HostReplyRoomState) ?? new(false, NotReady, null);

    private const string NotReady = "Your world is still opening.";

    private static BridgeJsonContext Ctx => BridgeJsonContext.Default;

    private HostReply<T>? Host<T>(Func<string> call, System.Text.Json.Serialization.Metadata.JsonTypeInfo<HostReply<T>> type) =>
        _mounted ? JsonSerializer.Deserialize(call(), type) : null;

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

    public void XamlFocus(bool focused)
    {
        if (_mounted)
            GameHost.XamlFocus(focused);
    }

    public void Reload() => global::Uno.Foundation.WebAssemblyRuntime.InvokeJS("location.reload()");
}
