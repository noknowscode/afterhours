using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// Signing a linked character out of this device; its rooms, furniture and tracks stay saved.
public partial record SignOutModel(ISocial Social, INavigator Navigator)
{
    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask SignOut(CancellationToken ct)
    {
        var reply = await Social.Act("confirmSignOut");
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.CloseSheetAsync(this, ct);
    }

    public async ValueTask Stay(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            await Social.Act("sessions");
    }
}
