using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Restoring a linked character with Google (the page leaves for Google and comes back signed in).
public partial record RestoreModel(ISocial Social, INavigator Navigator)
{
    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Continue(CancellationToken ct)
    {
        var reply = await Social.Act("restore");
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }

    public async ValueTask Back(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("sessions");
    }
}
