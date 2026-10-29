using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media;

namespace Afterhours.Uno.Converters;

// True to TrueBrush, anything else to FalseBrush (step cells: on and off).
public sealed class BoolToBrushConverter : IValueConverter
{
    public Brush? TrueBrush { get; set; }

    public Brush? FalseBrush { get; set; }

    public object? Convert(object value, Type targetType, object parameter, string language) => value is true ? TrueBrush : FalseBrush;

    public object ConvertBack(object value, Type targetType, object parameter, string language) => throw new NotSupportedException();
}
