package dev.sdlc.factory.app.web;

import dev.sdlc.factory.app.host.HostAcceptanceService;
import dev.sdlc.factory.app.web.dto.HostAcceptanceRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** 仅绑定 loopback 的 OpenCode 宿主纵切验收入口。 */
@RestController
@RequestMapping("/api/projects/{projectId}/host-acceptance")
public class HostAcceptanceController {

    private final HostAcceptanceService service;

    public HostAcceptanceController(HostAcceptanceService service) {
        this.service = service;
    }

    @PostMapping
    public Map<String, Object> execute(@PathVariable String projectId,
                                       @RequestBody HostAcceptanceRequest request) {
        return service.execute(projectId, request.objective());
    }
}
