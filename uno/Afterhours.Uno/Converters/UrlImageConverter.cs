using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media.Imaging;

namespace Afterhours.Uno.Converters;

// An http(s) URL to an image. Many cards crop the same few furniture atlases, so each URL loads once.
public sealed class UrlImageConverter : IValueConverter
{
    private static readonly Dictionary<string, BitmapImage> Cache = [];

    public object? Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is not string url || !Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return null;
        if (!Cache.TryGetValue(url, out var image))
            Cache[url] = image = new BitmapImage(uri);
        return image;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
        => throw new NotSupportedException();
}
