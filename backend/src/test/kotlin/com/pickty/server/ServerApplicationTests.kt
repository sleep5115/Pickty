package com.pickty.server

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.containers.wait.strategy.Wait
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.utility.DockerImageName

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class ServerApplicationTests {

	companion object {
		@JvmStatic
		@Container
		val postgres: PostgreSQLContainer<*> = PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))

		@JvmStatic
		@Container
		val valkey: GenericContainer<*> = GenericContainer(DockerImageName.parse("valkey/valkey:9-alpine"))
			.withExposedPorts(6379)
			.waitingFor(Wait.forListeningPort())

		@JvmStatic
		@DynamicPropertySource
		fun configure(registry: DynamicPropertyRegistry) {
			registry.add("spring.datasource.url", postgres::getJdbcUrl)
			registry.add("spring.datasource.username", postgres::getUsername)
			registry.add("spring.datasource.password", postgres::getPassword)
			registry.add("spring.datasource.driver-class-name") { "org.postgresql.Driver" }
			registry.add("spring.data.redis.host", valkey::getHost)
			registry.add("spring.data.redis.port") { "${valkey.getMappedPort(6379)}" }
		}
	}

	@Test
	fun contextLoads() {
	}

}
