package dev.sdlc.factory.app.web;

import dev.sdlc.factory.persistence.ProjectInitializationRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OperationsProjectionControllerTest {

    @Test
    void returnsRepositoryOwnedReadModelsWithoutMutation() {
        ProjectInitializationRepository repository = mock(ProjectInitializationRepository.class);
        List<Map<String, Object>> runs = List.of(Map.of("run_id", "RUN-1", "lane", "RUNNING"));
        List<Map<String, Object>> attention = List.of(Map.of("attention_id", "ATT-1", "category", "REVIEW"));
        when(repository.runBoard()).thenReturn(runs);
        when(repository.attentionItems()).thenReturn(attention);

        OperationsProjectionController controller = new OperationsProjectionController(repository);

        assertSame(runs, controller.runs());
        assertSame(attention, controller.attention());
    }
}
