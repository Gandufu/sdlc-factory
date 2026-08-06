package dev.sdlc.factory.app.web.dto;

/** 创建项目时接受模板选择和新项目的绝对路径，不接受任意命令。 */
public record CreateProjectRequest(
        String projectName,
        String workspacePath,
        String templateId,
        String templateVersion) {
}
