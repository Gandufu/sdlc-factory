package dev.sdlc.factory.app.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Run 事件 SSE 流入口。
 *
 * <p>Renderer 通过 REST 执行命令与查询，通过本 SSE 接收运行事件
 * （v1.2 §2.3 Desktop Console 技术选型）。</p>
 */
@RestController
@RequestMapping("/api/runs")
public class RunEventStreamController {

    private final RunEventPublisher publisher;

    public RunEventStreamController(RunEventPublisher publisher) {
        this.publisher = publisher;
    }

    /** 订阅运行事件流。 */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events() {
        return publisher.subscribe();
    }
}
