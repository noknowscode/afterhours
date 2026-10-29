using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls.Primitives;
using Windows.Foundation;

namespace Afterhours.Uno.Interop;

// Read-only view of the live XAML tree for the runtime check (scripts/verify-xaml.mjs): every visible element
// with a name or text, its window bounds, enabled state and value. Skia draws the UI on one canvas, so the page
// has no DOM to inspect, and Uno's accessibility mirror lags behind panels that are still opening.
[System.Runtime.Versioning.SupportedOSPlatform("browser")]
internal static partial class UiProbe
{
    public static XamlRoot? Root { get; set; }

    [JSExport]
    public static string Snapshot()
    {
        var found = new List<ProbeNode>();
        if (Root?.Content is UIElement content)
            Walk(content, Window(Root), found);
        if (Root is not null)
            foreach (var popup in VisualTreeHelper.GetOpenPopupsForXamlRoot(Root))
                if (popup.Child is UIElement child)
                    Walk(child, Window(Root), found);
        return JsonSerializer.Serialize(found, ProbeJson.Default.ListProbeNode);
    }

    private static Rect Window(XamlRoot root) => new(0, 0, root.Size.Width, root.Size.Height);

    // Collapsed or transparent subtrees are skipped; scroll viewers clip what lies outside them.
    private static void Walk(UIElement element, Rect clip, List<ProbeNode> found)
    {
        if (element.Visibility == Visibility.Collapsed || element.Opacity == 0 || element is not FrameworkElement fe)
            return;
        Rect bounds;
        // null: relative to the window.
        try { bounds = fe.TransformToVisual(null!).TransformBounds(new Rect(0, 0, fe.ActualWidth, fe.ActualHeight)); }
        catch (ArgumentException) { return; }
        // A container can report no size yet still show children (a Canvas, or layout in progress), so only a
        // sized element outside the clip ends the walk.
        var visible = Intersect(bounds, clip);
        if (visible is null && bounds.Width > 0 && bounds.Height > 0)
            return;
        if (visible is { } shown && Describe(fe) is { } text)
            found.Add(new(fe.GetType().Name, text, Math.Round(shown.X), Math.Round(shown.Y), Math.Round(shown.Width),
                Math.Round(shown.Height), fe is not Control control || control.IsEnabled, Value(fe)));
        var inner = fe is ScrollViewer && visible is { } port ? port : clip;
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(fe); i++)
            if (VisualTreeHelper.GetChild(fe, i) is UIElement child)
                Walk(child, inner, found);
    }

    private static Rect? Intersect(Rect a, Rect b)
    {
        double left = Math.Max(a.X, b.X), top = Math.Max(a.Y, b.Y), right = Math.Min(a.X + a.Width, b.X + b.Width), bottom = Math.Min(a.Y + a.Height, b.Y + b.Height);
        return right > left && bottom > top ? new Rect(left, top, right - left, bottom - top) : (Rect?)null;
    }

    // An explicit automation name wins; text and simple content come next.
    private static string? Describe(FrameworkElement fe)
    {
        var name = AutomationProperties.GetName(fe);
        if (!string.IsNullOrEmpty(name))
            return name;
        return fe switch
        {
            TextBlock { Text: { Length: > 0 } text } => text,
            FontIcon { Glyph: { Length: > 0 } glyph } => glyph,
            ContentControl { Content: string { Length: > 0 } content } => content,
            TextBox { PlaceholderText: { Length: > 0 } placeholder } => placeholder,
            _ => null,
        };
    }

    private static string? Value(FrameworkElement fe) => fe switch
    {
        TextBox box => box.Text,
        RangeBase range => range.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
        ToggleButton toggle => toggle.IsChecked?.ToString(),
        ComboBox combo => combo.SelectedItem?.ToString(),
        _ => null,
    };
}

internal sealed record ProbeNode(string Type, string Text, double X, double Y, double W, double H, bool Enabled, string? Value);

[System.Text.Json.Serialization.JsonSourceGenerationOptions(PropertyNamingPolicy = System.Text.Json.Serialization.JsonKnownNamingPolicy.CamelCase)]
[System.Text.Json.Serialization.JsonSerializable(typeof(List<ProbeNode>))]
internal sealed partial class ProbeJson : System.Text.Json.Serialization.JsonSerializerContext;
