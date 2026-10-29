using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media.Imaging;

namespace Afterhours.Uno.Converters;

// "data:image/png;base64,…" from the game to an image. A plain string binding does not load data URLs.
public sealed class DataUrlImageConverter : IValueConverter
{
    public object? Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is not string url || !url.StartsWith("data:image/png;base64,", StringComparison.Ordinal))
            return null;
        var image = new BitmapImage();
        var bytes = System.Convert.FromBase64String(url[(url.IndexOf(',') + 1)..]);
        _ = image.SetSourceAsync(new MemoryStream(bytes).AsRandomAccessStream());
        return image;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
        => throw new NotSupportedException();
}
