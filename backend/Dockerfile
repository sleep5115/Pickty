# Build (JDK 25 — Spring Boot 4 / Kotlin toolchain 과 맞춤)
FROM eclipse-temurin:25-jdk-noble AS builder
WORKDIR /workspace

COPY gradle gradle
COPY gradlew ./
RUN chmod +x gradlew

COPY build.gradle.kts settings.gradle.kts ./
COPY src src

RUN ./gradlew bootJar --no-daemon -x test

# Run
FROM eclipse-temurin:25-jre-noble
WORKDIR /app

RUN useradd --system --no-create-home --shell /usr/sbin/nologin pickty
COPY --from=builder /workspace/build/libs/*.jar /app/app.jar
RUN chown pickty:pickty /app/app.jar

USER pickty
EXPOSE 8080

ENV JAVA_OPTS="-XX:MaxRAMPercentage=70.0"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
