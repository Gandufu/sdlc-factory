package dev.sdlc.factory.app.host;

import dev.sdlc.factory.contracts.handoff.Handoff;
import dev.sdlc.factory.contracts.host.HostUsage;

/** Node/TypeScript OpenCode Bridge 返回给 Java 控制平面的窄接口。 */
public record OpenCodeBridgeResponse(
        String protocolVersion,
        String invocationId,
        String modelRef,
        String hostVersion,
        String sdkVersion,
        String hostSessionId,
        String finish,
        HostUsage usage,
        Handoff handoff) {
}
