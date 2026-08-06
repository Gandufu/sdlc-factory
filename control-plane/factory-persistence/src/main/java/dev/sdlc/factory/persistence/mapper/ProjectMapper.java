package dev.sdlc.factory.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import dev.sdlc.factory.persistence.entity.ProjectEntity;

/**
 * 项目 Mapper：简单 CRUD 直接使用 MyBatis-Plus BaseMapper 内置能力。
 */
public interface ProjectMapper extends BaseMapper<ProjectEntity> {
}
