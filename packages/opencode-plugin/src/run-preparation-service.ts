import { findModule, findRequirementMap, isModuleDesignFacts } from "./artifact-validator.js";
import { currentVersion } from "./candidate-service.js";
import type { ApprovedVersion, RunRecord } from "./domain.js";
import { readGitBase } from "./git-service.js";
import type { ProjectStore } from "./project-store.js";
import { RunService } from "./run-service.js";
import { findModuleByExactName, StatusService } from "./status-service.js";
import { assertApprovedCodeIntegrity, codeVersionDependsOn } from "./version-integrity.js";

type RuntimeValues = { id(): string; now(): string };

export class RunPreparationService {
  constructor(
    private readonly store: ProjectStore,
    private readonly workspaceRoot: string,
    private readonly runtime: RuntimeValues,
  ) {}

  async start(command: string, moduleName: string | undefined, sessionId: string): Promise<RunRecord> {
    const status = await new StatusService(this.store).read();
    const versions = await this.store.listJson<ApprovedVersion>("approved-versions");
    const map = findRequirementMap(versions);
    const gitBase = await readGitBase(this.workspaceRoot);
    if (!status.designSetVersionId || !map) throw new Error("总设计版本批准并有效后才能开始编码或测试运行");

    let runInput: Omit<RunRecord, "runId" | "createdAt">;
    if (command === "/sdlc-test system") {
      if (moduleName && moduleName !== "system") throw new Error("系统测试不能指定业务模块名称");
      const incomplete = status.modules?.filter((module) => !module.moduleTestVersionId || module.moduleTestResult !== "PASSED") ?? [];
      if (incomplete.length > 0) {
        throw new Error(`以下业务模块尚无当前通过的模块测试: ${incomplete.map((item) => item.moduleName).join("、")}`);
      }
      const inputVersionIds = [status.designSetVersionId];
      for (const module of status.modules ?? []) inputVersionIds.push(module.codeVersionId!, module.moduleTestVersionId!);
      runInput = {
        command,
        commandType: "SYSTEM_TEST",
        sessionId,
        scope: { type: "SYSTEM", id: "system", name: "系统" },
        gitBase,
        inputVersionIds,
        allowedProductPaths: map.businessModules.flatMap((module) => {
          const design = currentVersion(versions, "MODULE_DESIGN", module.moduleId);
          return isModuleDesignFacts(design?.facts) ? design.facts.productPaths : [];
        }),
        allowedTestPaths: map.businessModules.flatMap((module) => {
          const design = currentVersion(versions, "MODULE_DESIGN", module.moduleId);
          return isModuleDesignFacts(design?.facts) ? design.facts.testPaths : [];
        }),
      };
    } else {
      if (!moduleName) throw new Error("业务模块运行必须提供完整模块名称");
      const moduleProgress = findModuleByExactName(status, moduleName);
      const module = findModule(versions, moduleProgress.moduleId)!;
      const codeCommand = `/sdlc-code ${module.name}`;
      const testCommand = `/sdlc-test ${module.name}`;
      if (command !== codeCommand && command !== testCommand) {
        throw new Error(`运行命令必须包含完整业务模块名称: ${codeCommand} 或 ${testCommand}`);
      }
      const isCode = command === codeCommand;
      if (isCode && (![
        "CODING", "MODULE_TEST", "SYSTEM_TEST", "COMPLETED",
      ].includes(moduleProgress.stage) || ["WAITING_REVIEW", "SUSPENDED", "IN_PROGRESS"].includes(moduleProgress.state))) {
        throw new Error(`业务模块当前不能进入编码: ${moduleProgress.state}/${moduleProgress.stage}`);
      }
      if (!isCode && (![
        "MODULE_TEST", "SYSTEM_TEST", "COMPLETED",
      ].includes(moduleProgress.stage) || ["WAITING_REVIEW", "SUSPENDED", "IN_PROGRESS"].includes(moduleProgress.state))) {
        throw new Error(`业务模块当前不能进入模块测试: ${moduleProgress.state}/${moduleProgress.stage}`);
      }
      const design = currentVersion(versions, "MODULE_DESIGN", module.moduleId)!;
      if (!isModuleDesignFacts(design.facts)) throw new Error(`模块设计缺少实现路径边界: ${design.versionId}`);
      const dependencyCodeVersionIds = module.dependencies.map((dependencyId) => {
        const dependencyCode = currentVersion(versions, "CODE", dependencyId);
        if (!dependencyCode) throw new Error(`依赖模块尚无已批准代码: ${dependencyId}`);
        return dependencyCode.versionId;
      });
      const currentCodeVersions = map.businessModules
        .map((item) => currentVersion(versions, "CODE", item.moduleId))
        .filter((version): version is ApprovedVersion => Boolean(version));
      const downstreamCodeVersionIds = !isCode && moduleProgress.codeVersionId
        ? currentCodeVersions
          .filter((version) => codeVersionDependsOn(
            version,
            moduleProgress.codeVersionId!,
            currentCodeVersions,
          ))
          .map((version) => version.versionId)
        : [];
      const inputVersionIds = isCode
        ? [...new Set([
          status.requirementSetVersionId!, status.designSetVersionId!,
          moduleProgress.requirementVersionId!, design.versionId,
          ...(moduleProgress.codeVersionId ? [moduleProgress.codeVersionId] : []),
          ...dependencyCodeVersionIds,
        ])]
        : [...new Set([
          status.designSetVersionId!, design.versionId, moduleProgress.codeVersionId!,
          ...dependencyCodeVersionIds, ...downstreamCodeVersionIds,
        ])];
      runInput = {
        command,
        commandType: isCode ? "CODE" : "MODULE_TEST",
        sessionId,
        scope: { type: "MODULE", id: module.moduleId, name: module.name },
        gitBase,
        inputVersionIds,
        allowedProductPaths: design.facts.productPaths,
        allowedTestPaths: design.facts.testPaths,
      };
    }

    await assertApprovedCodeIntegrity(this.store, this.workspaceRoot, runInput.inputVersionIds);
    return new RunService(this.store, this.runtime).start(runInput);
  }
}
