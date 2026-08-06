package dev.sdlc.factory.app.web;

import dev.sdlc.factory.contracts.error.ErrorCategory;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    @Test
    void shouldExposeInputValidationMessageWithoutReportingInternalFailure() {
        var response = new GlobalExceptionHandler()
                .handleInvalidArgument(new IllegalArgumentException("workspace_path 必须是绝对路径"));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, response.getStatusCode());
        assertEquals(ErrorCategory.VALIDATION, response.getBody().category());
        assertEquals("workspace_path 必须是绝对路径", response.getBody().message());
    }
}
