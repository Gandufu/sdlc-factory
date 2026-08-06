package dev.sdlc.factory.persistence.mapper;

import dev.sdlc.factory.persistence.projection.RunDetailProjection;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * Run 详情查询 Mapper（复杂多表 SQL）。
 *
 * <p>按 v1.2 约定，复杂多表 SQL 一律写在
 * resources/mapper/RunDetailQueryMapper.xml，接口只声明契约。</p>
 */
public interface RunDetailQueryMapper {

    /**
     * 查询项目下 Run 的完整详情（run × project × capability_unit 三表连接）。
     *
     * @param projectId 项目 ID
     * @return Run 详情投影列表（按创建时间倒序）
     */
    List<RunDetailProjection> selectRunDetailsByProject(@Param("projectId") String projectId);

    /**
     * 查询等待容量与活动中的 Run（Operations 看板的只读投影来源）。
     *
     * @return 全局 Run 详情投影列表
     */
    List<RunDetailProjection> selectCapacityBoard();
}
