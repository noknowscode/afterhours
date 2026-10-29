using System.Text.RegularExpressions;

namespace Afterhours.Uno.Tests;

public partial class CommandContractTests
{
    [GeneratedRegex(@"(\w+): '[^']+'")]
    private static partial Regex HostCommand();

    [GeneratedRegex(@"Command=""\{Binding Run\}""\s+CommandParameter=""(\w+)""")]
    private static partial Regex XamlRun();

    // Every Run command in the XAML must name a command host.mjs allowlists, or the button would do nothing.
    [Theory]
    [InlineData("uno/Afterhours.Uno/MainPage.xaml")]
    [InlineData("uno/Afterhours.Uno/Views/ChatPanel.xaml")]
    public void Xaml_commands_exist_in_the_host_allowlist(string page)
    {
        var host = Repo.Read("dist/host.mjs");
        var block = host[host.IndexOf("export const commands")..host.IndexOf("});", host.IndexOf("export const commands"))];
        var allowed = HostCommand().Matches(block).Select(m => m.Groups[1].Value).ToHashSet();
        var used = XamlRun().Matches(Repo.Read(page)).Select(m => m.Groups[1].Value).ToList();

        Assert.NotEmpty(used);
        Assert.All(used, name => Assert.Contains(name, allowed));
    }
}
