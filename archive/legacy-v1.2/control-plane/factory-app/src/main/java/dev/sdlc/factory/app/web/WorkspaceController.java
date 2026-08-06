package dev.sdlc.factory.app.web;

import dev.sdlc.factory.app.web.dto.CreateSessionRequest;
import dev.sdlc.factory.app.web.dto.DecideWorkspaceGateRequest;
import dev.sdlc.factory.app.web.dto.SendSessionMessageRequest;
import dev.sdlc.factory.app.workspace.WorkspaceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** 项目连续会话工作区的查询与显式命令边界。 */
@RestController
@RequestMapping("/api/projects/{projectId}")
public class WorkspaceController {

    private final WorkspaceService service;

    public WorkspaceController(WorkspaceService service) {
        this.service = service;
    }

    @GetMapping("/workspace")
    public Map<String, Object> workspace(@PathVariable String projectId) {
        return service.workspace(projectId);
    }

    @GetMapping("/sessions/{sessionId}")
    public Map<String, Object> session(@PathVariable String projectId, @PathVariable String sessionId) {
        return service.session(projectId, sessionId);
    }

    @PostMapping("/sessions")
    public Map<String, Object> create(@PathVariable String projectId, @RequestBody CreateSessionRequest request) {
        return service.createSession(projectId, request.parentSessionId(), request.agent(), request.title());
    }

    @PostMapping("/sessions/{sessionId}/archive")
    public Map<String, Object> archive(@PathVariable String projectId, @PathVariable String sessionId) {
        return service.archive(projectId, sessionId);
    }

    @PostMapping("/sessions/{sessionId}/messages")
    public Map<String, Object> send(@PathVariable String projectId, @PathVariable String sessionId,
                                    @RequestBody SendSessionMessageRequest request) {
        return service.send(projectId, sessionId, request.content());
    }

    @PostMapping("/gates/{gateId}/approve")
    public Map<String, Object> approve(@PathVariable String projectId, @PathVariable String gateId,
                                       @RequestBody DecideWorkspaceGateRequest request) {
        return service.decide(projectId, gateId, request.reviewerIdentity(), request.comments(),
                request.idempotencyKey(), request.expectedVersion(), true);
    }

    @PostMapping("/gates/{gateId}/request-changes")
    public Map<String, Object> requestChanges(@PathVariable String projectId, @PathVariable String gateId,
                                              @RequestBody DecideWorkspaceGateRequest request) {
        return service.decide(projectId, gateId, request.reviewerIdentity(), request.comments(),
                request.idempotencyKey(), request.expectedVersion(), false);
    }

    @PostMapping("/sessions/{sessionId}/runs/{runId}/recover")
    public Map<String, Object> recover(@PathVariable String projectId, @PathVariable String sessionId,
                                      @PathVariable String runId) {
        return service.recover(projectId, sessionId, runId);
    }
}
