using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The resident journal: quests to collect, badges, and the wallet's ledger.
public partial record JournalModel(IResident Resident, JournalRequest Request)
{
    public IState<string> Tab => State.Value(this, () => Request.Tab);

    public IFeed<JournalTabs> Tabs => Tab.Select(tab => new JournalTabs(tab));

    public IState<JournalState> Journal => State.Value(this, Resident.Journal);

    public IListFeed<QuestView> Quests => Journal.Select(j => (IImmutableList<QuestView>)ResidentRules.Quests(j)).AsListFeed();

    public IListFeed<BadgeView> Badges => Journal.Select(j => (IImmutableList<BadgeView>)ResidentRules.Badges(j)).AsListFeed();

    public IListFeed<LedgerView> Ledger => Journal.Select(j => (IImmutableList<LedgerView>)ResidentRules.Ledger(j)).AsListFeed();

    public IFeed<string> Coins => Journal.Select(j => $"{j.Coins} ✦");

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask ShowTab(string tab, CancellationToken ct) => await Tab.UpdateAsync(_ => tab, ct);

    public async ValueTask Claim(QuestView quest, CancellationToken ct)
    {
        var reply = Resident.ClaimQuest(quest.Id);
        if (reply.Result is { } journal)
            await Journal.UpdateAsync(_ => journal, ct);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
    }
}
