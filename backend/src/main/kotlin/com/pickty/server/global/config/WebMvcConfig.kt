package com.pickty.server.global.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.nio.file.Paths

@Configuration
class WebMvcConfig : WebMvcConfigurer {

    // /uploads CORS는 Spring Security corsConfigurationSource()에서 처리 (WebMvc addCorsMappings는 보통 무시됨)

    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        val root = Paths.get(System.getProperty("user.home"), "Desktop", "pickty_uploads")
            .toAbsolutePath()
            .normalize()
        val uri = root.toUri().toString()
        val location = if (uri.endsWith("/")) uri else "$uri/"
        registry.addResourceHandler("/uploads/**")
            .addResourceLocations(location)
            .setCachePeriod(3600)
    }
}
