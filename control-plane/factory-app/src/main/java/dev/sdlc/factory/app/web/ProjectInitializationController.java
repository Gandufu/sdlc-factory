package dev.sdlc.factory.app.web;

import dev.sdlc.factory.app.initialization.ProjectInitializationService;
import dev.sdlc.factory.app.web.dto.ApproveInitializationRequest;
import dev.sdlc.factory.app.web.dto.CreateProjectRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 项目目录与模板驱动初始化的 REST 边界。 */
@RestController
@RequestMapping("/api")
public class ProjectInitializationController {

    private final ProjectInitializationService service;

    public ProjectInitializationController(ProjectInitializationService service) {
        this.service = service;
    }

    @GetMapping("/templates")
    public List<Map<String, Object>> templates() {
        return service.templates();
    }

    @GetMapping("/projects")
    public List<Map<String, Object>> projects() {
        return service.projects();
    }

    @GetMapping("/projects/{projectId}")
    public Map<String, Object> project(@PathVariable String projectId) {
        return service.project(projectId);
    }

    @PostMapping("/projects")
    public Map<String, Object> create(@RequestBody CreateProjectRequest request) {
        return service.initialize(request.projectName(), request.directoryName(),
                request.templateId(), request.templateVersion());
    }

    @PostMapping("/projects/{projectId}/initialization/approve")
    public Map<String, Object> approve(@PathVariable String projectId,
                                       @RequestBody ApproveInitializationRequest request) {
        return service.approve(projectId, request.reviewerIdentity(), request.comments(), request.idempotencyKey());
    }
}
