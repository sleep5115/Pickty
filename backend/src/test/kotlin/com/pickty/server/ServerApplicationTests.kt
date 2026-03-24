package com.pickty.server

import com.pickty.server.domain.tier.TierTemplate
import com.pickty.server.domain.tier.TierTemplateRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.annotation.Transactional
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

	@Autowired
	private lateinit var tierTemplateRepository: TierTemplateRepository

	@Autowired
	private lateinit var entityManager: EntityManager

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

	@Test
	@Transactional
	fun tierTemplateThumbnailUrlsJsonbRoundTrip() {
		val entity = TierTemplate(
			title = "jsonb-thumb-test",
			itemsPayload = mapOf(
				"items" to listOf(
					mapOf("id" to "a", "name" to "A", "imageUrl" to "https://img.pickty.app/item.png"),
				),
			),
		)
		val urls = listOf(
			"https://img.pickty.app/one.png",
			"https://img.pickty.app/two.png",
			"https://img.pickty.app/three.png",
			"https://img.pickty.app/four.png",
		)
		entity.thumbnailUrls = urls
		entity.listThumbnailUsesCustom = true
		val saved = tierTemplateRepository.saveAndFlush(entity)
		val id = saved.id ?: error("template id expected")
		entityManager.clear()
		val loaded = tierTemplateRepository.findById(id).orElseThrow()
		assertThat(loaded.thumbnailUrls).containsExactlyElementsOf(urls)
		assertThat(loaded.listThumbnailUsesCustom).isTrue()
	}

}
