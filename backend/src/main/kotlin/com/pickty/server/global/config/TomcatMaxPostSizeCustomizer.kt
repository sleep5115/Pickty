package com.pickty.server.global.config

import org.apache.catalina.connector.Connector
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.context.annotation.Configuration

/**
 * 커넥터 maxPostSize를 `application.yaml` 의 multipart 한도와 동일하게 고정.
 * 프론트는 이미지마다 별도 POST(단일 파일)이나, 프록시·Tomcat 기본값 불일치로 413 나는 것을 방지.
 */
@Configuration
class TomcatMaxPostSizeCustomizer : WebServerFactoryCustomizer<TomcatServletWebServerFactory> {

    override fun customize(factory: TomcatServletWebServerFactory) {
        factory.addConnectorCustomizers({ connector: Connector ->
            connector.maxPostSize = MAX_POST_BYTES
        })
    }

    companion object {
        /** Nginx `client_max_body_size` · spring.servlet.multipart 와 동일 (8MiB) */
        private const val MAX_POST_BYTES = 8 * 1024 * 1024
    }
}
