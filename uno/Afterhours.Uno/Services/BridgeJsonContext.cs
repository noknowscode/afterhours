using System.Collections.Immutable;
using System.Text.Json.Serialization;

namespace Afterhours.Uno.Services;

// Source-generated so parsing survives trimming in the WebAssembly publish.
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Hud))]
[JsonSerializable(typeof(Portrait))]
[JsonSerializable(typeof(Chrome))]
[JsonSerializable(typeof(ChatState))]
[JsonSerializable(typeof(ReadyEvent))]
[JsonSerializable(typeof(ShopData))]
[JsonSerializable(typeof(OpenRequest))]
[JsonSerializable(typeof(ActionReply))]
[JsonSerializable(typeof(ImmutableList<OwnedItem>))]
[JsonSerializable(typeof(ImmutableList<RoomRef>))]
[JsonSerializable(typeof(ImmutableList<Disc>))]
[JsonSerializable(typeof(ImmutableList<Blueprint>))]
[JsonSerializable(typeof(ImmutableList<Song>))]
[JsonSerializable(typeof(StudioReply))]
[JsonSerializable(typeof(Playback))]
[JsonSerializable(typeof(ImmutableList<string>))]
[JsonSerializable(typeof(StageView))]
internal sealed partial class BridgeJsonContext : JsonSerializerContext;
