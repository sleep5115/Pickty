package com.pickty.server.global.config

import org.apache.catalina.connector.Connector
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.context.annotation.Configuration

/**
 * YAML만으로는 환경에 따라 Tomcat maxPostSize가 남는 경우가 있어,
 * 커넥터에 직접 80MB를 설정 (대용량 멀티파트 POST 대비).
 */
@Configuration
class TomcatMaxPostSizeCustomizer : WebServerFactoryCustomizer<TomcatServletWebServerFactory> {

    override fun customize(factory: TomcatServletWebServerFactory) {
        factory.addConnectorCustomizers({ connector: Connector ->
            connector.maxPostSize = EIGHTY_MB
        })
    }

    companion object {
        private const val EIGHTY_MB = 80 * 1024 * 1024
    }
}
