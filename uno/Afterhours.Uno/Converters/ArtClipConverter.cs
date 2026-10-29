using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media;

namespace Afterhours.Uno.Converters;

// ArtFrame.ClipRect to the clip that shows only its crop (geometry properties cannot be bound in a template).
public sealed class ArtClipConverter : IValueConverter
{
    public object? Convert(object value, Type targetType, object parameter, string language) =>
        value is System.Drawing.RectangleF r ? new RectangleGeometry { Rect = new(r.X, r.Y, r.Width, r.Height) } : null;

    public object ConvertBack(object value, Type targetType, object parameter, string language)
        => throw new NotSupportedException();
}
