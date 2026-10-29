namespace Afterhours.Uno.Views;

public sealed partial class JoinPage : Page
{
    public JoinPage()
    {
        this.InitializeComponent();
        // xaml-lint: allow codebehind - the security widget needs a native element the game can find. Native elements
        // sit under the Skia canvas, so a transparent one shows the hosted room through it; it takes the sheet's colour.
        Loaded += (_, _) =>
        {
            if (Challenge.Element is not { } element)
                return;
            element.SetHtmlAttribute("data-account-challenge", "");
            if (Resources.TryGetValue("SurfacePanelColor", out var colour) || Application.Current.Resources.TryGetValue("SurfacePanelColor", out colour))
                element.SetCssStyle("background-color", colour is Windows.UI.Color c ? $"#{c.R:x2}{c.G:x2}{c.B:x2}" : "transparent");
        };
    }
}
