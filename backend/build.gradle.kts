import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.springframework.boot.gradle.tasks.run.BootRun

plugins {
	kotlin("jvm") version "2.2.21"
	kotlin("plugin.spring") version "2.2.21"
	id("org.springframework.boot") version "4.0.3"
	id("io.spring.dependency-management") version "1.1.7"
	kotlin("plugin.jpa") version "2.2.21"
}

group = "com.pickty"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
	sourceCompatibility = JavaVersion.VERSION_24
	targetCompatibility = JavaVersion.VERSION_24
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-client")
	implementation("org.springframework.boot:spring-boot-starter-data-redis")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	implementation("tools.jackson.module:jackson-module-kotlin")
	implementation(platform("software.amazon.awssdk:bom:2.30.38"))
	implementation("software.amazon.awssdk:s3")
	// Hibernate 7 @JdbcTypeCode(JSON/jsonb): JacksonJsonFormatMapper는 Jackson 2(com.fasterxml…) 전용.
	// implementation — IDE 실행·테스트 클래스패스에도 포함 (runtimeOnly만이면 누락될 수 있음).
	// Spring Boot 4 웹 직렬화는 Jackson 3(tools.jackson) — 패키지가 달라 공존.
	implementation("com.fasterxml.jackson.core:jackson-databind:2.18.2")
	// Hibernate jsonb FormatMapper(Jackson 2) — List<String> 등 Kotlin 컬렉션 역직렬화 안정화
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.18.2")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testImplementation(platform("org.testcontainers:testcontainers-bom:1.20.6"))
	testImplementation("org.testcontainers:junit-jupiter")
	testImplementation("org.testcontainers:postgresql")
	testImplementation("org.testcontainers:testcontainers")
}

kotlin {
	compilerOptions {
		jvmTarget = JvmTarget.JVM_24
		freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
	}
}

allOpen {
	annotation("jakarta.persistence.Entity")
	annotation("jakarta.persistence.MappedSuperclass")
	annotation("jakarta.persistence.Embeddable")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

tasks.named<BootRun>("bootRun") {
	systemProperty("spring.profiles.active", "dev")
}

tasks.register<BootRun>("bootRunLocal") {
	group = "application"
	description = "Run with local profile (Docker pickty — 스키마/마이그레이션 검증 등)"
	classpath = sourceSets["main"].runtimeClasspath
	mainClass = tasks.named<BootRun>("bootRun").get().mainClass
	systemProperty("spring.profiles.active", "local")
}
