package dev.sdlc.factory.app.web;

import dev.sdlc.factory.persistence.ProjectInitializationRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 运行与人工注意事项的只读 HTTP 投影。 */
@RestController
@RequestMapping("/api")
public class OperationsProjectionController {

    private final ProjectInitializationRepository repository;

    public OperationsProjectionController(ProjectInitializationRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/runs/board")
    public List<Map<String, Object>> runs() {
        return repository.runBoard();
    }

    @GetMapping("/attention")
    public List<Map<String, Object>> attention() {
        return repository.attentionItems();
    }
}
