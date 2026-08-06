package dev.sdlc.factory.app.initialization;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProjectInitializationServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void shouldAcceptNormalizedAbsoluteWorkspacePath() {
        Path target = temporaryDirectory.resolve("parent").resolve("..").resolve("new-project");

        assertEquals(temporaryDirectory.resolve("new-project"),
                ProjectInitializationService.resolveWorkspace(target.toString()));
    }

    @Test
    void shouldRejectRelativePathAndFileSystemRoot() {
        assertThrows(IllegalArgumentException.class,
                () -> ProjectInitializationService.resolveWorkspace("relative-project"));
        assertThrows(IllegalArgumentException.class,
                () -> ProjectInitializationService.resolveWorkspace(temporaryDirectory.getRoot().toString()));
    }
}
