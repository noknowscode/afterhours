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
            new ViewMap<ChartPage, ChartModel>());
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
                new("Chart", View: views.FindByViewModel<ChartModel>()),
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
