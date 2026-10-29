using System.Runtime.CompilerServices;

namespace Afterhours.Uno.Presentation;

public static class Sheets
{
    private static readonly ConditionalWeakTable<object, object> Closed = [];

    // Closes the sheet that owns this model, once. A second click while the sheet closes would otherwise navigate
    // back again: it closes the sheet that just opened, and further backs can leave the page. True when this call
    // closed it, so a follow-up (open the next panel, start a round) runs once too.
    public static async Task<bool> CloseSheetAsync(this INavigator navigator, object model, CancellationToken ct)
    {
        if (!Closed.TryAdd(model, model))
            return false;
        await navigator.NavigateBackAsync(model, cancellation: ct);
        return true;
    }
}
