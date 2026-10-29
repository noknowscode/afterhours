namespace Afterhours.Uno;

public sealed partial class MainPage : Page
{
    public MainPage()
    {
        this.InitializeComponent();
        // xaml-lint: allow codebehind - the room is a native element; its id is only known here.
        Loaded += (_, _) => MountRoom();
        DataContextChanged += (_, _) => MountRoom();
        // The room's keyboard shortcuts wait while a XAML control (not the room itself) holds focus.
        Microsoft.UI.Xaml.Input.FocusManager.GotFocus += (_, e) =>
        {
            if (DataContext is MainViewModel { Model: var model })
                model.RoomView.XamlFocus(e.NewFocusedElement is Control control && control != Room);
        };
    }

    private void MountRoom()
    {
        if (IsLoaded && DataContext is MainViewModel { Model: var model } && Room.Element is { } element)
            _ = model.Mount(element.ElementId);
    }
}
