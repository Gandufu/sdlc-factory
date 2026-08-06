package dev.sdlc.factory.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import dev.sdlc.factory.persistence.entity.RunEntity;

/**
 * Run Mapper：单表 CRUD 使用 BaseMapper；
 * 跨表 Run 详情查询见 {@link RunDetailQueryMapper}。
 */
public interface RunMapper extends BaseMapper<RunEntity> {
}
