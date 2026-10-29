using Microsoft.UI.Xaml.Documents.TextFormatting;

namespace Afterhours.Uno;

// The Skia renderer draws only with fonts the app ships, so symbols (✦ ◉ ♫ …) and emoji come from two bundled
// fonts, fetched from the app package the first time such a character is drawn. Without this, Uno's default
// fallback downloads a ~16 MB CJK font from GitHub to draw ✦. See Assets/Fonts/licenses/README.md.
internal static class SymbolFonts
{
    private static readonly Dictionary<string, string> Files = new()
    {
        ["Afterhours Symbols"] = "AfterhoursSymbols_Regular.ttf",
        ["Noto Emoji"] = "NotoEmoji_Regular.ttf",
    };

    // Must run before any text renders: the font cache reads both once.
    public static void Configure()
    {
        // Restoring a save uses a plain file input (testable, and works in every browser).
        global::Uno.WinRTFeatureConfiguration.Storage.Pickers.WasmConfiguration = global::Uno.WasmPickerConfiguration.DownloadUpload;
        global::Uno.UI.FeatureConfiguration.Font.DefaultTextFontFamily = "ms-appx:///Assets/Fonts/DMSans_Regular.ttf#DM Sans";
        global::Uno.UI.FeatureConfiguration.Font.FallbackService = new CoverageTableFontFallbackService(
            [
                // Letterlike symbols through Misc Symbols and Arrows (end exclusive).
                new FontFallbackCoverageRange(0x2100, 0x2C00, ["Afterhours Symbols"]),
                new FontFallbackCoverageRange(0x1F000, 0x1FB00, ["Noto Emoji"]),
            ],
            fontStreamProvider: async (family, weight, stretch, style, ct) =>
            {
                if (!Files.TryGetValue(family, out var file))
                    return null;
                var font = await StorageFile.GetFileFromApplicationUriAsync(new Uri($"ms-appx:///Assets/Fonts/{file}"));
                return await font.OpenStreamForReadAsync();
            });
    }
}
