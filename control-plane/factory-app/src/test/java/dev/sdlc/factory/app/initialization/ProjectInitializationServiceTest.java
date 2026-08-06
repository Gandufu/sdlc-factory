package dev.sdlc.factory.app.initialization;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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

    @Test
    void shouldAcceptExistingEmptyWorkspaceDirectory() throws IOException {
        Path workspace = Files.createDirectory(temporaryDirectory.resolve("empty-project"));

        assertDoesNotThrow(() -> ProjectInitializationService.ensureWorkspaceAvailable(workspace));
    }

    @Test
    void shouldRejectExistingNonEmptyWorkspaceDirectory() throws IOException {
        Path workspace = Files.createDirectory(temporaryDirectory.resolve("occupied-project"));
        Files.writeString(workspace.resolve("README.md"), "existing content");

        assertThrows(IllegalArgumentException.class,
                () -> ProjectInitializationService.ensureWorkspaceAvailable(workspace));
    }
}
