namespace Afterhours.Uno.Tests;

internal static class Repo
{
    // The repository root: the nearest parent holding package.json.
    public static string Root { get; } = Find(AppContext.BaseDirectory);

    public static string Read(string relative) => File.ReadAllText(Path.Combine(Root, relative));

    private static string Find(string start)
    {
        for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "package.json")))
                return dir.FullName;
        throw new DirectoryNotFoundException("Could not find the repository root from " + start);
    }
}
