using System.Collections.Immutable;
using System.Text.Json;

namespace Afterhours.Uno.Services;

// Game state the XAML reads. Phase A reads it from the JavaScript game; Phase B swaps in C# rules.
public interface IGameStore
{
    IAsyncEnumerable<Hud> WatchHud(CancellationToken ct);

    IAsyncEnumerable<Portrait> WatchPortrait(CancellationToken ct);

    bool TryGetSlice(string key, out JsonElement value);

    IAsyncEnumerable<ShopData> WatchShop(CancellationToken ct);

    IAsyncEnumerable<Inventory> WatchInventory(CancellationToken ct);

    // Writes. Each runs the game's own action; a failed reply carries the game's message.
    ActionReply Buy(string type);

    Task<ActionReply> Place(string itemId);

    ActionReply Use(string itemId);

    ActionReply Wrap(string giftId, string contentId, string note);

    ActionReply SaveBlueprint();

    ActionReply RestoreBlueprint(string blueprintId);

    ActionReply PlayDisc(string discId);

    IAsyncEnumerable<ImmutableList<Song>> WatchSongs(CancellationToken ct);

    // Studio edits (step, mute, solo, volume, tempo, length, undo, clear, new) reply with the whole draft.
    StudioReply Studio(string op, double a = 0, double b = 0);

    // Studio edits that take text: pack, title, edit (a song id), save (the title).
    StudioReply StudioText(string op, string text);

    ActionReply PressDisc(string songId);

    ActionReply DeleteSong(string songId);

    // Queues the song for the stage; the game then asks for the stage panel.
    ActionReply Perform(string songId);

    ActionReply SavePlaylist(IEnumerable<string> songIds);
}
