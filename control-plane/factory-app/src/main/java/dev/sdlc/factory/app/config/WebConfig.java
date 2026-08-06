package dev.sdlc.factory.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Desktop Console 跨源访问配置。
 *
 * <p>开发态 Renderer 来自固定 loopback Vite 地址，打包态来自受信的
 * {@code app://bundle} 自定义协议。这里只开放控制平面 API 所需方法，
 * 不使用通配来源，也不允许携带浏览器凭据。</p>
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /** 为 Electron Renderer 注册最小 CORS（跨源资源共享）边界。 */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://127.0.0.1:5173", "http://localhost:5173", "app://bundle")
                .allowedMethods("GET", "POST")
                .allowedHeaders("Content-Type")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
