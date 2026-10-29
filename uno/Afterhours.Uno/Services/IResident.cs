namespace Afterhours.Uno.Services;

// The player's own things: journal, profile, saves and outfit. Phase A reads them from the JavaScript game.
public interface IResident
{
    JournalState Journal();

    HostReply<JournalState> ClaimQuest(string questId);

    ProfileState Profile();

    HostReply<ProfileState> SaveProfile(string name, string motto, string chatColor);

    // Downloads the save as JSON.
    ActionReply ExportSave();

    // A save file's text, or the last backup, checked first; ConfirmRestore then replaces the world.
    HostReply<RestorePrompt> InspectSave(string text);

    HostReply<RestorePrompt> InspectBackup();

    ActionReply ConfirmRestore();

    WardrobeState? Wardrobe();

    Outfit PresetOutfit(int index);

    // A PNG data URL of the outfit (front, back or seated; portrait crops to the head and shoulders).
    Task<string> RenderOutfit(Outfit outfit, string pose, bool portrait = false);

    ActionReply SaveLook(Outfit outfit, int preset);

    // Opens the game's classic sprite picker.
    void ClassicLook();

    ArcadeState Arcade();

    // Starts a round; the round and its results are game panels.
    void PlayArcade(string kind);

    PetState Companion();

    HostReply<PetState> AdoptPet(string name);

    // feed, play, train, follow (toggle), sit or spin.
    HostReply<PetState> PetAction(string action);

    // A PNG data URL of the companion.
    string PetPortrait();
}
