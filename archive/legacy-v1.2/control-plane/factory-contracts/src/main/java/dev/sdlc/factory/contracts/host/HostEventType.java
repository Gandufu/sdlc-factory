package dev.sdlc.factory.contracts.host;

/** 宿主运行事件类型（host-run-event.schema.json: event_type）。 */
public enum HostEventType {
    SESSION_STARTED,
    MESSAGE_PART,
    TOOL_STARTED,
    TOOL_COMPLETED,
    USAGE_UPDATED,
    SESSION_IDLE,
    SESSION_ABORTED,
    HOST_ERROR
}
