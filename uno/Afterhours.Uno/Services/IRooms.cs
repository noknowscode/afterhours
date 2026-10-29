namespace Afterhours.Uno.Services;

// Your rooms and the shared navigator, room tools, portals and the pieces in a room. Phase A asks the JavaScript game.
public interface IRooms
{
    RoomsState Rooms();

    // A navigator key (public:n, my:id, or a shared room's key). Ringing a doorbell counts as done.
    Task<ActionReply> GoTo(string key);

    ActionReply CreateRoom(string name, string description, string tags);

    RoomState Room();

    // Opens one of room tools' other panels: blueprints, rules, notes, playlist, event, or home (go to my room).
    void OpenRoomPanel(string name);

    HostReply<RoomState> SaveSettings(string name, string description, string tags, string lighting, string door);

    HostReply<RoomState> AddNote(string text);

    HostReply<RoomState> DeleteNote(string noteId);

    HostReply<RoomState> AddRule(string trigger, string effect, string phrase, string message);

    HostReply<RoomState> DeleteRule(string ruleId);

    // Delay is in minutes.
    HostReply<RoomState> HostEvent(string name, int delay);

    HostReply<RoomState> EndEvent();

    ActionReply LinkPortal(string itemId, string roomId);

    RoomObject? Object();

    // Runs one of the object's actions; most walk you over to the piece first.
    ActionReply ObjectAction(int index);

    // Picks the piece up in edit mode.
    ActionReply MoveObject();
}
