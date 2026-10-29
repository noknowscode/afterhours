namespace Afterhours.Uno.Views;

public sealed partial class ChatPanel : UserControl
{
    public ChatPanel()
    {
        this.InitializeComponent();
        // xaml-lint: allow codebehind - ItemsStackPanel.ItemsUpdatingScrollMode is Uno0001 (not implemented),
        // so keep the newest line in view by scrolling when the list changes.
        Lines.Items.VectorChanged += (_, _) =>
        {
            if (Lines.Items.Count > 0)
                Lines.ScrollIntoView(Lines.Items[^1]);
        };
    }
}
