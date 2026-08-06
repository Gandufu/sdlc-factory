package dev.sdlc.factory.contracts.handoff;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * 结构化交接单（handoff.schema.json）。
 *
 * <p>v1.2 不变量 10：Handoff 必须通过版本化结构化协议提交，不能从聊天尾部解析；
 * 交接单丢失时运行失败，工厂不根据文件变化伪造“无问题”。</p>
 *
 * @param protocolVersion      协议版本，固定 1.0
 * @param handoffId            HND- 标识
 * @param runId                关联 Run
 * @param sliceId              关联切片（可选）
 * @param role                 提交角色
 * @param summary              摘要
 * @param observations         观察记录
 * @param declaredChangedPaths 声明的变更路径（实际 Diff 由工厂独立计算）
 * @param validations          验证声明
 * @param openIssues           未解决问题
 * @param requestedFollowUp    建议的后续动作（可选，仅建议不推进状态）
 * @param submittedAt          提交时间
 */
public record Handoff(
        String protocolVersion,
        String handoffId,
        String runId,
        String sliceId,
        HandoffRole role,
        String summary,
        List<String> observations,
        List<String> declaredChangedPaths,
        List<HandoffValidation> validations,
        List<String> openIssues,
        String requestedFollowUp,
        Instant submittedAt) {

    public Handoff {
        Objects.requireNonNull(protocolVersion, "protocolVersion 不能为空");
        Objects.requireNonNull(handoffId, "handoffId 不能为空");
        Objects.requireNonNull(runId, "runId 不能为空");
        Objects.requireNonNull(role, "role 不能为空");
        Objects.requireNonNull(summary, "summary 不能为空");
        Objects.requireNonNull(submittedAt, "submittedAt 不能为空");
        if (!"1.0".equals(protocolVersion)) {
            throw new dev.sdlc.factory.common.ContractViolationException("protocol_version 必须为 1.0");
        }
        observations = observations == null ? List.of() : List.copyOf(observations);
        declaredChangedPaths = declaredChangedPaths == null ? List.of() : List.copyOf(declaredChangedPaths);
        validations = validations == null ? List.of() : List.copyOf(validations);
        openIssues = openIssues == null ? List.of() : List.copyOf(openIssues);
    }
}
