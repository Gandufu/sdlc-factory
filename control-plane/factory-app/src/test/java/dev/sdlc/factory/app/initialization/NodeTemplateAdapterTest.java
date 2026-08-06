package dev.sdlc.factory.app.initialization;

import dev.sdlc.factory.runner.ProcessTreeTerminator;
import dev.sdlc.factory.runner.WindowsProcessRunner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NodeTemplateAdapterTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void shouldGenerateAndValidateNodeProject() throws Exception {
        Path project = temporaryDirectory.resolve("generated-project");
        NodeTemplateAdapter template = new NodeTemplateAdapter(
                new WindowsProcessRunner(new ProcessTreeTerminator()));

        template.instantiate(project, "初始化测试项目");
        template.requireSuccess("bootstrap", template.bootstrap(project));
        var results = template.validate(project);
        results.forEach(template::requireSuccess);
        var runtime = template.runtimeCycleResult(results.get("RUNTIME_CYCLE"));

        assertTrue(Files.exists(project.resolve("package.json")));
        assertFalse(template.revision(project).isBlank());
        assertTrue(runtime.processId() > 0);
        assertTrue(runtime.port() > 0);
    }
}
