using System.Collections.Immutable;

namespace Afterhours.Uno.Services;

// The JavaScript room: its scene, the chrome state it reports, and the commands it accepts.
public interface IRoomView
{
    IAsyncEnumerable<BridgeStatus> WatchStatus(CancellationToken ct);

    IAsyncEnumerable<ImmutableList<PublicRoom>> WatchPublicRooms(CancellationToken ct);

    IAsyncEnumerable<Chrome> WatchChrome(CancellationToken ct);

    IAsyncEnumerable<ChatState> WatchChat(CancellationToken ct);

    // Panels the game asks the app to open (for example the shop from a records cabinet).
    IAsyncEnumerable<OpenRequest> WatchOpenRequests(CancellationToken ct);

    Task MountAsync(string elementId);

    // Runs one of the commands in host.mjs's allowlist. Returns false when the game has it disabled.
    bool Run(string command);

    bool Travel(int index);

    bool Say(string text, string mode, string? target);

    void Focus();

    // Whether a XAML control holds keyboard focus. The room's shortcuts (1, 2, Space, R…) wait while one does:
    // on Skia the browser's focus stays on the page body, so the game cannot tell by itself.
    void XamlFocus(bool focused);

    void Reload();
}
