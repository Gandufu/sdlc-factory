package dev.sdlc.factory.app.web.dto;

/** 创建项目时只接受模板选择和受控目录名，不接受任意命令或绝对路径。 */
public record CreateProjectRequest(
        String projectName,
        String directoryName,
        String templateId,
        String templateVersion) {
}
