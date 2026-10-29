namespace Afterhours.Uno.Services;

// Your circle, residents, chat preferences and the shared world's people and trades. Phase A asks the JavaScript game.
public interface ISocial
{
    // While anyone watches, the game sends the social state as it changes.
    IAsyncEnumerable<SocialState> WatchSocial(CancellationToken ct);

    // The social state now (the join panel reads it once).
    SocialState Now();

    // A shared-world action by name (friend, accept, decline, unfriend, follow, block, report, kick, ban, letIn, deny,
    // trade, tradeAccept, tradeOffer, tradeConfirm, tradeCancel, awaySeen, link, leave, retry, join with the name as text,
    // restore, confirmSignOut), or a panel the game opens next (rooms, stage, friends, sessions, player, openTrade,
    // signOut, restorePanel). Result is a new trade's id.
    Task<SocialReply> Act(string op, string id = "", string text = "");

    ResidentState? Resident(string name);

    // friend or block (each toggles).
    ResidentState? ResidentAct(string name, string op);

    void OpenResident(string name);

    ChatPrefs ChatPrefs();

    ChatPrefs SaveChatPrefs(bool muteResidents);

    ChatPrefs Unblock(string name);
}
