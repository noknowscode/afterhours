using System.Runtime.InteropServices.JavaScript;

namespace Afterhours.Uno.Interop;

// The only C# that calls the game's JavaScript. Functions live in game/host.mjs.
[System.Runtime.Versioning.SupportedOSPlatform("browser")]
internal static partial class GameHost
{
    private const string Module = "afterhours";

    public static Task ImportAsync(string url) => JSHost.ImportAsync(Module, url);

    [JSImport("mount", Module)]
    public static partial Task Mount(string elementId, [JSMarshalAs<JSType.Function<JSType.String>>] Action<string> onEvent);

    [JSImport("invoke", Module)]
    public static partial bool Invoke(string command);

    [JSImport("travel", Module)]
    public static partial bool Travel(int index);

    [JSImport("say", Module)]
    public static partial bool Say(string text, string mode, string target);

    [JSImport("focusRoom", Module)]
    public static partial void FocusRoom();

    [JSImport("xamlFocus", Module)]
    public static partial void XamlFocus(bool focused);

    // Writes reply with {ok, error, result} as JSON.
    [JSImport("buy", Module)]
    public static partial string Buy(string type);

    [JSImport("place", Module)]
    public static partial Task<string> Place(string itemId);

    [JSImport("use", Module)]
    public static partial string Use(string itemId);

    [JSImport("wrap", Module)]
    public static partial string Wrap(string giftId, string contentId, string note);

    [JSImport("saveBlueprint", Module)]
    public static partial string SaveBlueprint();

    [JSImport("restoreBlueprint", Module)]
    public static partial string RestoreBlueprint(string blueprintId);

    [JSImport("playDisc", Module)]
    public static partial string PlayDisc(string discId);

    // Studio edits reply with {ok, error, result: {draft, canUndo}}. One JS function, two argument shapes.
    [JSImport("studio", Module)]
    public static partial string Studio(string op, double a, double b);

    [JSImport("studio", Module)]
    public static partial string StudioText(string op, string text);

    // An empty id toggles the studio draft.
    [JSImport("playTrack", Module)]
    public static partial string PlayTrack(string songId);

    [JSImport("exportWav", Module)]
    public static partial Task<string> ExportWav();

    [JSImport("pressDisc", Module)]
    public static partial string PressDisc(string songId);

    [JSImport("deleteSong", Module)]
    public static partial string DeleteSong(string songId);

    [JSImport("perform", Module)]
    public static partial string Perform(string songId);

    // Song ids as a JSON array.
    [JSImport("savePlaylist", Module)]
    public static partial string SavePlaylist(string songIds);

    [JSImport("playPlaylist", Module)]
    public static partial string PlayPlaylist(string songIds);

    [JSImport("stage", Module)]
    public static partial string Stage(string op, string songId);

    [JSImport("stageWatch", Module)]
    public static partial void StageWatch(bool on);

    [JSImport("journal", Module)]
    public static partial string Journal();

    [JSImport("claimQuest", Module)]
    public static partial string ClaimQuest(string questId);

    [JSImport("profile", Module)]
    public static partial string Profile();

    [JSImport("saveProfile", Module)]
    public static partial string SaveProfile(string name, string motto, string chatColor);

    [JSImport("exportSave", Module)]
    public static partial string ExportSave();

    [JSImport("inspectSave", Module)]
    public static partial string InspectSave(string text);

    [JSImport("inspectBackup", Module)]
    public static partial string InspectBackup();

    [JSImport("confirmRestore", Module)]
    public static partial string ConfirmRestore();

    [JSImport("wardrobe", Module)]
    public static partial string Wardrobe();

    // Outfits travel as JSON.
    [JSImport("presetOutfit", Module)]
    public static partial string PresetOutfit(int index);

    [JSImport("outfitPreview", Module)]
    public static partial Task<string> OutfitPreview(string outfit, string pose, bool portrait);

    [JSImport("saveLook", Module)]
    public static partial string SaveLook(string outfit, int preset);

    [JSImport("classicLook", Module)]
    public static partial void ClassicLook();

    [JSImport("roomList", Module)]
    public static partial string Rooms();

    [JSImport("goToRoom", Module)]
    public static partial Task<string> GoToRoom(string key);

    [JSImport("createRoom", Module)]
    public static partial string CreateRoom(string name, string description, string tags);

    [JSImport("currentRoom", Module)]
    public static partial string Room();

    [JSImport("roomPanel", Module)]
    public static partial string RoomPanel(string name);

    [JSImport("saveRoomSettings", Module)]
    public static partial string SaveRoomSettings(string name, string description, string tags, string lighting, string door);

    [JSImport("addNote", Module)]
    public static partial string AddNote(string text);

    [JSImport("deleteNote", Module)]
    public static partial string DeleteNote(string noteId);

    [JSImport("addRule", Module)]
    public static partial string AddRule(string trigger, string effect, string phrase, string message);

    [JSImport("deleteRule", Module)]
    public static partial string DeleteRule(string ruleId);

    [JSImport("hostEvent", Module)]
    public static partial string HostEvent(string name, int delay);

    [JSImport("endEvent", Module)]
    public static partial string EndEvent();

    [JSImport("linkPortal", Module)]
    public static partial string LinkPortal(string itemId, string roomId);

    [JSImport("roomObject", Module)]
    public static partial string RoomObject();

    [JSImport("objectAction", Module)]
    public static partial string ObjectAction(int index);

    [JSImport("objectMove", Module)]
    public static partial string ObjectMove();

    [JSImport("arcade", Module)]
    public static partial string Arcade();

    [JSImport("playArcade", Module)]
    public static partial string PlayArcade(string kind);

    [JSImport("pet", Module)]
    public static partial string Pet();

    [JSImport("adoptPet", Module)]
    public static partial string AdoptPet(string name);

    [JSImport("petAction", Module)]
    public static partial string PetAction(string action);

    [JSImport("petPortrait", Module)]
    public static partial string PetPortrait();

    [JSImport("socialWatch", Module)]
    public static partial void SocialWatch(bool on);

    [JSImport("social", Module)]
    public static partial Task<string> Social(string op, string id, string text);

    [JSImport("resident", Module)]
    public static partial string Resident(string name);

    [JSImport("residentAct", Module)]
    public static partial string ResidentAct(string name, string op);

    [JSImport("openResident", Module)]
    public static partial void OpenResident(string name);

    [JSImport("chatPrefs", Module)]
    public static partial string ChatPrefs();

    [JSImport("saveChatPrefs", Module)]
    public static partial string SaveChatPrefs(bool mute);

    [JSImport("unblock", Module)]
    public static partial string Unblock(string name);
}
