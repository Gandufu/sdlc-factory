package dev.sdlc.factory.app;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AI 软件工厂控制平面应用入口。
 *
 * <p>v1.2 边界：</p>
 * <ul>
 *   <li>Spring Boot 拥有状态机、Gate、Evidence、审计与编排事实；</li>
 *   <li>只绑定 loopback，Electron 壳负责窗口与进程生命周期；</li>
 *   <li>MyBatis-Plus Mapper 集中在 persistence 模块，复杂 SQL 走 XML。</li>
 * </ul>
 */
@SpringBootApplication
@MapperScan("dev.sdlc.factory.persistence.mapper")
public class FactoryApplication {

    public static void main(String[] args) {
        SpringApplication.run(FactoryApplication.class, args);
    }
}
