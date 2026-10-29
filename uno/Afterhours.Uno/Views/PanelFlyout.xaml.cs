using Microsoft.UI.Xaml.Controls.Primitives;

namespace Afterhours.Uno.Views;

public sealed partial class PanelFlyout : Flyout
{
    public PanelFlyout()
    {
        this.InitializeComponent();
    }

    // xaml-lint: allow codebehind - the full-window sheet covers the area outside the panel, so light dismiss
    // (a tap outside the popup) never fires; the scrim closes it instead.
    protected override Control CreatePresenter()
    {
        var presenter = base.CreatePresenter();
        presenter.Loaded += (_, _) =>
        {
            if (VisualTreeHelper.GetChildrenCount(presenter) > 0 && VisualTreeHelper.GetChild(presenter, 0) is Grid { Children: [Border scrim, ..] })
                scrim.Tapped += (_, _) => Hide();
        };
        return presenter;
    }
}
