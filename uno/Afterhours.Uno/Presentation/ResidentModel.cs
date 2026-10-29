using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// A resident character in a public room: add them to your circle, whisper, or block their replies.
public partial record ResidentModel(ISocial Social, IRoomView RoomView, INavigator Navigator, ResidentRequest Request)
{
    public IState<ResidentState> Resident => State.Value(this, () => Social.Resident(Request.Name) ?? new(Request.Name, "", false, false));

    public IFeed<string> FriendLabel => Resident.Select(r => r.Friend ? "Remove from circle" : "Add to my circle");

    public IFeed<string> BlockLabel => Resident.Select(r => r.Blocked ? "Unblock" : "Block replies");

    public async ValueTask ToggleFriend(CancellationToken ct)
    {
        if (Social.ResidentAct(Request.Name, "friend") is { } resident)
            await Resident.UpdateAsync(_ => resident, ct);
    }

    public async ValueTask Whisper(CancellationToken ct)
    {
        if (await Navigator.CloseSheetAsync(this, ct))
            RoomView.WhisperTo(Request.Name);
    }

    public async ValueTask ToggleBlock(CancellationToken ct)
    {
        Social.ResidentAct(Request.Name, "block");
        await Navigator.CloseSheetAsync(this, ct);
    }
}
