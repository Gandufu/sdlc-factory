package dev.sdlc.factory.app.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Run 事件发布器（SSE 广播）。
 *
 * <p>Renderer 通过 SSE 接收运行事件；发布失败只记录日志，
 * 不影响任何 Run/Gate/Baseline 事实（观测失败不得改变业务状态，
 * v1.2 §11.1）。</p>
 */
@Component
public class RunEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(RunEventPublisher.class);

    /** SSE 超时：0 表示由容器与心跳管理，此处给 30 分钟。 */
    static final long SSE_TIMEOUT_MS = 30L * 60 * 1000;

    /** 当前活跃的 SSE 订阅（控制台实例数量有限，列表即可）。 */
    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** 登记一个新订阅；客户端断开时自动移除。 */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        return emitter;
    }

    /** 向全部订阅广播一条运行事件；任一订阅失败只移除该订阅。 */
    public void publish(Map<String, Object> event) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("run-event").data(event));
            } catch (IOException | IllegalStateException e) {
                log.debug("移除失效 SSE 订阅：{}", e.getMessage());
                emitters.remove(emitter);
            }
        }
    }

    /** 当前订阅数（观测用）。 */
    public int subscriberCount() {
        return emitters.size();
    }
}
