package dev.sdlc.factory.orchestration;

import java.util.List;
import java.util.Objects;

/**
 * 执行切片（v1.2 §4.5 Coding）。
 *
 * <p>Implementation Planner 依据 DesignSliceManifest 与覆盖断言拆分；
 * 切片只声明支持哪些断言，不能修改断言内容。
 * 同一 CU 的切片在项目唯一工作目录中严格顺序执行。</p>
 *
 * @param sliceId                 切片 ID
 * @param cuId                    所属能力单元
 * @param objective               切片目标
 * @param supportedAssertionIds   支持的 Validation Assertion ID
 * @param sequenceIndex           顺序下标（0 起，严格递增执行）
 */
public record ExecutionSlice(
        String sliceId,
        String cuId,
        String objective,
        List<String> supportedAssertionIds,
        int sequenceIndex) {

    public ExecutionSlice {
        Objects.requireNonNull(sliceId, "sliceId 不能为空");
        Objects.requireNonNull(cuId, "cuId 不能为空");
        Objects.requireNonNull(objective, "objective 不能为空");
        supportedAssertionIds = supportedAssertionIds == null
                ? List.of() : List.copyOf(supportedAssertionIds);
        if (sequenceIndex < 0) {
            throw new IllegalArgumentException("sequenceIndex 不能为负数");
        }
    }
}
