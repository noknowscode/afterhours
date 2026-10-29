namespace Afterhours.Uno;

public sealed partial class MainPage : Page
{
    public MainPage()
    {
        this.InitializeComponent();
        // xaml-lint: allow codebehind - the room is a native element; its id is only known here.
        Loaded += (_, _) => MountRoom();
        DataContextChanged += (_, _) => MountRoom();
    }

    private void MountRoom()
    {
        if (IsLoaded && DataContext is MainViewModel { Model: var model } && Room.Element is { } element)
            _ = model.Mount(element.ElementId);
    }
}
