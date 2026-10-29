using Afterhours.Uno.Presentation;
using Microsoft.UI.Xaml.Controls.Primitives;

namespace Afterhours.Uno.Views;

public sealed partial class StudioPage : Page
{
    public StudioPage()
    {
        this.InitializeComponent();
    }

    // xaml-lint: allow codebehind - Slider has no command; a lane's volume is sent while its slider moves.
    // A value equal to the lane's own (the binding following a reply) sends nothing.
    private void OnVolumeChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (sender is Slider { DataContext: LaneView lane } && Math.Abs(e.NewValue - lane.Volume) >= 1
            && DataContext is StudioViewModel { Model: var model })
            _ = model.SetVolume(lane.Key, e.NewValue, CancellationToken.None);
    }
}
