export enum Events {
    UpdateView = 0,
    DeleteView = 1,
    UpdateViewsTree = 2,
    RequestViewsTree = 3,
    RespondToEvent = 4,
    RequestEvent = 5,
    StreamChunk = 6,
    StreamEnd = 7,
}

export enum EventContent {
    Data = 0,
    Uid = 1,
    EventUid = 2,
    ParentUid = 3,
    ChildIndex = 4,
    isRoot = 5,
    EventArgs = 6,
    // 7 reserved (wire protocol gap)
    Views = 8,
    Props = 9,
    Create = 10,
    // 11 reserved (wire protocol gap)
    Delete = 12,
    Name = 13,
    Type = 14,
    Event = 15,
    StreamUid = 16,
    Chunk = 17,
    Stream = 18,
}
