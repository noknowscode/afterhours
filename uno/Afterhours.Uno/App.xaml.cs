using System;
using Microsoft.Extensions.Logging;
using Afterhours.Uno.Services;
using Afterhours.Uno.Views;
using Uno.Resizetizer;

namespace Afterhours.Uno;

public partial class App : Application
{
    /// <summary>
    /// Initializes the singleton application object. This is the first line of authored code
    /// executed, and as such is the logical equivalent of main() or WinMain().
    /// </summary>
    public App()
    {
        SymbolFonts.Configure();
        this.InitializeComponent();
    }

    protected Window? MainWindow { get; private set; }
    protected IHost? Host { get; private set; }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Trimming", "IL2026", Justification = "Uno.Extensions navigation and MVUX are used as in the Uno template.")]
    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        var builder = this.CreateBuilder(args)
            .UseToolkitNavigation()
            .Configure(host => host
                .ConfigureServices(services =>
                {
                    // The game runs as JavaScript in the browser page (the app's only target).
                    if (OperatingSystem.IsBrowser())
                    {
                        var game = new JsGame(new GameEvents());
                        services.AddSingleton<IGameStore>(game);
                        services.AddSingleton<IRoomView>(game);
                        services.AddSingleton<IMusic>(game);
                        services.AddSingleton<IStage>(game);
                        services.AddSingleton<IResident>(game);
                        services.AddSingleton<IRooms>(game);
                        services.AddSingleton<ISocial>(game);
                    }
                })
                .UseNavigation(ReactiveViewModelMappings.ViewModelMappings, RegisterRoutes)
                // Panels open as a right drawer; replaces the centred NavigationFlyout UseNavigation registers.
                .ConfigureServices(services => services.AddTransient<Flyout, PanelFlyout>()));
        MainWindow = builder.Window;
#if DEBUG
        MainWindow.UseStudio();
#endif
        MainWindow.SetWindowIcon();
        Host = await builder.NavigateAsync<Shell>();
        // The runtime check reads the XAML tree through UiProbe (the Skia renderer has no DOM to inspect).
        if (OperatingSystem.IsBrowser())
            Interop.UiProbe.Root = MainWindow.Content?.XamlRoot;
    }

    private static void RegisterRoutes(IViewRegistry views, IRouteRegistry routes)
    {
        views.Register(
            new ViewMap(ViewModel: typeof(ShellModel)),
            new ViewMap<MainPage, MainModel>(),
            new DataViewMap<CatalogPage, CatalogModel, CatalogRequest>(),
            new ViewMap<BlueprintsPage, BlueprintsModel>(),
            new DataViewMap<WrapGiftPage, WrapGiftModel, WrapGiftRequest>(),
            new DataViewMap<StudioPage, StudioModel, StudioRequest>(),
            new ViewMap<JukeboxPage, JukeboxModel>(),
            new ViewMap<StagePage, StageModel>(),
            new DataViewMap<JournalPage, JournalModel, JournalRequest>(),
            new ViewMap<ProfilePage, ProfileModel>(),
            new ViewMap<WardrobePage, WardrobeModel>(),
            new ViewMap<HelpPage>(),
            new ViewMap<ChartPage, ChartModel>(),
            new DataViewMap<RoomsPage, RoomsModel, RoomsRequest>(),
            new ViewMap<RoomToolsPage, RoomToolsModel>(),
            new ViewMap<RoomLogicPage, RoomLogicModel>(),
            new ViewMap<RoomEventPage, RoomEventModel>(),
            new ViewMap<MessageBoardPage, MessageBoardModel>(),
            new DataViewMap<PortalPage, PortalModel, ItemRequest>(),
            new DataViewMap<RoomObjectPage, RoomObjectModel, ItemRequest>(),
            new ViewMap<CompanionPage, CompanionModel>(),
            new ViewMap<ArcadePage, ArcadeModel>(),
            new ViewMap<FriendsPage, FriendsModel>(),
            new DataViewMap<ResidentPage, ResidentModel, ResidentRequest>(),
            new DataViewMap<PlayerPage, PlayerModel, PlayerRequest>(),
            new DataViewMap<TradePage, TradeModel, TradeRequest>(),
            new ViewMap<AwayPage, AwayModel>(),
            new ViewMap<SharedWorldPage, SharedWorldModel>(),
            new ViewMap<ChatPrefsPage, ChatPrefsModel>());
        routes.Register(
            new RouteMap("", View: views.FindByViewModel<ShellModel>(), Nested:
            [
                new("Main", View: views.FindByViewModel<MainModel>(), IsDefault: true),
                new("Catalog", View: views.FindByViewModel<CatalogModel>()),
                new("Blueprints", View: views.FindByViewModel<BlueprintsModel>()),
                new("WrapGift", View: views.FindByViewModel<WrapGiftModel>()),
                new("Studio", View: views.FindByViewModel<StudioModel>()),
                new("Jukebox", View: views.FindByViewModel<JukeboxModel>()),
                new("Stage", View: views.FindByViewModel<StageModel>()),
                new("Journal", View: views.FindByViewModel<JournalModel>()),
                new("Profile", View: views.FindByViewModel<ProfileModel>()),
                new("Wardrobe", View: views.FindByViewModel<WardrobeModel>()),
                new("Help", View: views.FindByView<HelpPage>()),
                new("Chart", View: views.FindByViewModel<ChartModel>()),
                new("Rooms", View: views.FindByViewModel<RoomsModel>()),
                new("RoomTools", View: views.FindByViewModel<RoomToolsModel>()),
                new("RoomLogic", View: views.FindByViewModel<RoomLogicModel>()),
                new("RoomEvent", View: views.FindByViewModel<RoomEventModel>()),
                new("MessageBoard", View: views.FindByViewModel<MessageBoardModel>()),
                new("Portal", View: views.FindByViewModel<PortalModel>()),
                new("RoomObject", View: views.FindByViewModel<RoomObjectModel>()),
                new("Companion", View: views.FindByViewModel<CompanionModel>()),
                new("Arcade", View: views.FindByViewModel<ArcadeModel>()),
                new("Friends", View: views.FindByViewModel<FriendsModel>()),
                new("Resident", View: views.FindByViewModel<ResidentModel>()),
                new("Player", View: views.FindByViewModel<PlayerModel>()),
                new("Trade", View: views.FindByViewModel<TradeModel>()),
                new("Away", View: views.FindByViewModel<AwayModel>()),
                new("SharedWorld", View: views.FindByViewModel<SharedWorldModel>()),
                new("ChatPrefs", View: views.FindByViewModel<ChatPrefsModel>()),
            ]));
    }

    /// <summary>
    /// Configures global Uno Platform logging
    /// </summary>
    public static void InitializeLogging()
    {
#if DEBUG
        // Logging is disabled by default for release builds, as it incurs a significant
        // initialization cost from Microsoft.Extensions.Logging setup. If startup performance
        // is a concern for your application, keep this disabled. If you're running on the web or
        // desktop targets, you can use URL or command line parameters to enable it.
        //
        // For more performance documentation: https://platform.uno/docs/articles/Uno-UI-Performance.html

        var factory = LoggerFactory.Create(builder =>
        {
#if __WASM__
            builder.AddProvider(new global::Uno.Extensions.Logging.WebAssembly.WebAssemblyConsoleLoggerProvider());
#elif __IOS__
            builder.AddProvider(new global::Uno.Extensions.Logging.OSLogLoggerProvider());

            // Log to the Visual Studio Debug console
            builder.AddConsole();
#else
            builder.AddConsole();
#endif

            // Exclude logs below this level
            builder.SetMinimumLevel(LogLevel.Information);

            // Default filters for Uno Platform namespaces
            builder.AddFilter("Uno", LogLevel.Warning);
            builder.AddFilter("Windows", LogLevel.Warning);
            builder.AddFilter("Microsoft", LogLevel.Warning);

            // Generic Xaml events
            // builder.AddFilter("Microsoft.UI.Xaml", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.VisualStateGroup", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.StateTriggerBase", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.UIElement", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.FrameworkElement", LogLevel.Trace );

            // Layouter specific messages
            // builder.AddFilter("Microsoft.UI.Xaml.Controls", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.Controls.Layouter", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.Controls.Panel", LogLevel.Debug );

            // builder.AddFilter("Windows.Storage", LogLevel.Debug );

            // Binding related messages
            // builder.AddFilter("Microsoft.UI.Xaml.Data", LogLevel.Debug );
            // builder.AddFilter("Microsoft.UI.Xaml.Data", LogLevel.Debug );

            // Binder memory references tracking
            // builder.AddFilter("Uno.UI.DataBinding.BinderReferenceHolder", LogLevel.Debug );

            // DevServer and HotReload related
            // builder.AddFilter("Uno.UI.RemoteControl", LogLevel.Information);

            // Debug JS interop
            // builder.AddFilter("Uno.Foundation.WebAssemblyRuntime", LogLevel.Debug );
        });

        global::Uno.Extensions.LogExtensionPoint.AmbientLoggerFactory = factory;

#if HAS_UNO
        global::Uno.UI.Adapter.Microsoft.Extensions.Logging.LoggingAdapter.Initialize();
#endif
#endif
    }
}
