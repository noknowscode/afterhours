using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Chat preferences: mute resident replies, and unblock residents you blocked.
public partial record ChatPrefsModel(ISocial Social, INavigator Navigator)
{
    private readonly ChatPrefs _opened = Social.ChatPrefs();

    public IState<bool> Mute => State.Value(this, () => _opened.MuteResidents);

    public IState<ChatPrefs> Prefs => State.Value(this, () => _opened);

    public IListFeed<string> Blocked => Prefs.Select(p => (IImmutableList<string>)p.Blocked).AsListFeed();

    public IFeed<bool> NoneBlocked => Prefs.Select(p => p.Blocked.IsEmpty);

    public async ValueTask Save(CancellationToken ct)
    {
        Social.SaveChatPrefs(await Mute);
        await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask Unblock(string name, CancellationToken ct)
    {
        var prefs = Social.Unblock(name);
        await Prefs.UpdateAsync(_ => prefs, ct);
    }
}
