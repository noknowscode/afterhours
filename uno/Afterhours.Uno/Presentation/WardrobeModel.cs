using System.Collections.Immutable;
using Afterhours.Uno.Services;

namespace Afterhours.Uno.Presentation;

// The wardrobe: start from a classic look, change hair, top, bottoms, colours and skin, preview in three poses.
// The game's avatar renderer draws the preview.
public partial record WardrobeModel(IResident Resident, INavigator Navigator)
{
    private readonly WardrobeState? _opened = Resident.Wardrobe();

    public ImmutableList<PresetView> Presets => _opened?.Presets.Select((name, i) => new PresetView(i, name)).ToImmutableList() ?? [];

    public ImmutableList<string> Poses => ["Front", "Back", "Seated"];

    public IState<Outfit> Outfit => State.Value(this, () => _opened?.Outfit ?? new Outfit(1, "crop", "hoodie", "cargo", "chestnut", "moss", "ink", "sand"));

    public IState<int> Preset => State.Value(this, () => _opened?.Preset ?? 0);

    public IState<string> Pose => State.Value(this, () => "Front");

    public IFeed<string> Preview => Feed.Combine(Outfit, Pose).SelectAsync(async (x, ct) => await Resident.RenderOutfit(x.Item1, x.Item2.ToLowerInvariant()));

    public IListFeed<ChoiceView> Hair => Choices("hair", o => o.Hair, false);

    public IListFeed<ChoiceView> HairColors => Choices("hairColor", o => o.HairColors, true);

    public IListFeed<ChoiceView> Tops => Choices("top", o => o.Tops, false);

    public IListFeed<ChoiceView> TopColors => Choices("topColor", o => o.Colors, true);

    public IListFeed<ChoiceView> Bottoms => Choices("bottom", o => o.Bottoms, false);

    public IListFeed<ChoiceView> BottomColors => Choices("bottomColor", o => o.Colors, true);

    public IListFeed<ChoiceView> Skins => Choices("skin", o => o.SkinColors, true);

    public IState<string> Error => State.Value(this, () => "");

    public IFeed<bool> HasError => Error.Select(error => error.Length > 0);

    public async ValueTask Pick(ChoiceView choice, CancellationToken ct) =>
        await Outfit.UpdateAsync(o => ResidentRules.With(o!, choice.Field, choice.Id), ct);

    public async ValueTask StartFrom(PresetView preset, CancellationToken ct)
    {
        await Preset.UpdateAsync(_ => preset.Index, ct);
        await Outfit.UpdateAsync(_ => Resident.PresetOutfit(preset.Index), ct);
    }

    public async ValueTask ShowPose(string pose, CancellationToken ct) => await Pose.UpdateAsync(_ => pose, ct);

    public async ValueTask Save(CancellationToken ct)
    {
        var reply = Resident.SaveLook(await Outfit ?? _opened!.Outfit, await Preset);
        await Error.UpdateAsync(_ => reply.Ok ? "" : reply.Error ?? "", ct);
        if (reply.Ok)
            await Navigator.NavigateBackAsync(this, cancellation: ct);
    }

    public async ValueTask UseClassic(CancellationToken ct)
    {
        await Navigator.NavigateBackAsync(this, cancellation: ct);
        Resident.ClassicLook();
    }

    private IListFeed<ChoiceView> Choices(string field, Func<WardrobeState, ImmutableList<OutfitOption>> options, bool swatch) =>
        Outfit.Select(o => (IImmutableList<ChoiceView>)(_opened is null ? [] : ResidentRules.Choices(field, options(_opened), o, swatch))).AsListFeed();
}
