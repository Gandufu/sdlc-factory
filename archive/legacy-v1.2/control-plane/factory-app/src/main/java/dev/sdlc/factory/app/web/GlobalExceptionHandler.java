package dev.sdlc.factory.app.web;

import dev.sdlc.factory.common.ContractViolationException;
import dev.sdlc.factory.common.FactoryException;
import dev.sdlc.factory.common.IllegalStateTransitionException;
import dev.sdlc.factory.contracts.error.ErrorCategory;
import dev.sdlc.factory.contracts.error.ErrorEnvelope;
import dev.sdlc.factory.contracts.error.ErrorSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 全局错误处理器：把密封的工厂异常统一映射为 ErrorEnvelope 合同输出。
 *
 * <p>对 sealed 异常体系使用 switch 模式匹配，新增异常类型时
 * 编译器会强制此处补充分支——错误分类不会被悄悄遗漏。</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 错误序号（本机单实例演示用途；正式版使用 ULID/雪花 ID）。 */
    private final AtomicLong sequence = new AtomicLong();

    /** 处理合同违背异常。 */
    @ExceptionHandler(ContractViolationException.class)
    public ResponseEntity<ErrorEnvelope> handleContractViolation(ContractViolationException exception) {
        return handleFactoryException(exception);
    }

    /** 处理非法状态迁移异常。 */
    @ExceptionHandler(IllegalStateTransitionException.class)
    public ResponseEntity<ErrorEnvelope> handleIllegalTransition(IllegalStateTransitionException exception) {
        return handleFactoryException(exception);
    }

    /** 请求参数校验失败对调用方透明，不得伪装成内部故障。 */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorEnvelope> handleInvalidArgument(IllegalArgumentException exception) {
        ErrorEnvelope envelope = envelope(ErrorCategory.VALIDATION, exception.getMessage(), false);
        log.info("请求参数校验失败 [{}] {}", envelope.code(), envelope.message());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(envelope);
    }

    /**
     * 集中映射全部工厂领域异常。
     *
     * <p>FactoryException 是用于穷尽模式匹配的 sealed interface，并非 Throwable；
     * 因此公开的 Spring 异常处理方法按具体异常类型注册，再委托至此处。</p>
     */
    private ResponseEntity<ErrorEnvelope> handleFactoryException(FactoryException exception) {
        // 模式匹配 + 穷尽分支：每种异常的 HTTP 状态与合同分类在此集中决策
        HttpStatus status = switch (exception) {
            case ContractViolationException violation -> HttpStatus.UNPROCESSABLE_ENTITY;
            case IllegalStateTransitionException transition -> HttpStatus.CONFLICT;
        };
        ErrorCategory category = switch (exception) {
            case ContractViolationException violation -> ErrorCategory.VALIDATION;
            case IllegalStateTransitionException transition -> ErrorCategory.CONFLICT;
        };
        ErrorEnvelope envelope = envelope(category, exception.getMessage(), false);
        log.info("领域异常 [{}] {}", envelope.code(), envelope.message());
        return ResponseEntity.status(status).body(envelope);
    }

    /** 兜底：未预期异常一律 INTERNAL，且不泄漏堆栈细节给调用方。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorEnvelope> handleUnexpected(Exception exception) {
        log.error("未预期异常", exception);
        ErrorEnvelope envelope = envelope(ErrorCategory.INTERNAL, "内部错误，请查看诊断日志", true);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(envelope);
    }

    /** 构造符合合同格式的错误信封（run_id 用 NONE 占位表示非 Run 上下文）。 */
    private ErrorEnvelope envelope(ErrorCategory category, String message, boolean retryable) {
        long seq = sequence.incrementAndGet();
        // 错误指纹：正式实现使用错误签名哈希；切片阶段以序号摘要占位
        String fingerprint = dev.sdlc.factory.common.ContentHash
                .ofSha256(category + ":" + message).canonical();
        return new ErrorEnvelope(
                "ERR-APP-%06d".formatted(seq),
                "RUN-NONE",
                ErrorSource.FACTORY,
                category,
                category.name(),
                message,
                retryable,
                fingerprint,
                true,
                null,
                Instant.now());
    }
}
