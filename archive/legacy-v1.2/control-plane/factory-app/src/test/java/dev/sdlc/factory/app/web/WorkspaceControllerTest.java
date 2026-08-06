package dev.sdlc.factory.app.web;

import dev.sdlc.factory.app.web.dto.DecideWorkspaceGateRequest;
import dev.sdlc.factory.app.workspace.WorkspaceService;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WorkspaceControllerTest {

    @Test
    void approveForwardsExplicitReviewerIdempotencyAndExpectedVersion() {
        WorkspaceService service = mock(WorkspaceService.class);
        Map<String, Object> projection = Map.of("attention_count", 0);
        when(service.decide("PRJ-1", "GAT-1", "reviewer", "checked", "IDEM-1", 3, true))
                .thenReturn(projection);
        WorkspaceController controller = new WorkspaceController(service);

        Map<String, Object> result = controller.approve("PRJ-1", "GAT-1",
                new DecideWorkspaceGateRequest("reviewer", "checked", "IDEM-1", 3));

        assertSame(projection, result);
        verify(service).decide("PRJ-1", "GAT-1", "reviewer", "checked", "IDEM-1", 3, true);
    }
}
