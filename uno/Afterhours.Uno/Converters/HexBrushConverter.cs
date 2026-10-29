using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace Afterhours.Uno.Converters;

// A "#rrggbb" chat colour from the game to a brush; anything else falls back to Fallback.
public sealed class HexBrushConverter : IValueConverter
{
    public Brush? Fallback { get; set; }

    public object? Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is string { Length: 7 } hex && hex[0] == '#'
            && uint.TryParse(hex.AsSpan(1), System.Globalization.NumberStyles.HexNumber, null, out var rgb))
            return new SolidColorBrush(Color.FromArgb(0xFF, (byte)(rgb >> 16), (byte)(rgb >> 8), (byte)rgb));
        return Fallback;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
        => throw new NotSupportedException();
}
