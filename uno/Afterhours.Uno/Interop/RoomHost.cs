using Uno.UI.NativeElementHosting;

namespace Afterhours.Uno.Interop;

// Hosts the game's DOM (canvas room and its scene controls) in the same page as the XAML.
public sealed partial class RoomHost : ContentControl
{
    public RoomHost()
    {
        HorizontalContentAlignment = HorizontalAlignment.Stretch;
        VerticalContentAlignment = VerticalAlignment.Stretch;
        if (!OperatingSystem.IsBrowser())
            return;
        Element = BrowserHtmlElement.CreateHtmlElement("div");
        // WORKAROUND(BrowserHtmlElement inherits pointer-events none on the native renderer):
        // Uno 6.7.135 marks the hosting ContentControl chain pointer-events:none, so the room never
        // receives clicks. InputPolicy.NativeOnly does not change this on the native renderer.
        Element.SetCssStyle(("overflow", "auto"), ("width", "100%"), ("height", "100%"), ("pointer-events", "auto"));
        Content = Element;
    }

    public BrowserHtmlElement? Element { get; }
}
