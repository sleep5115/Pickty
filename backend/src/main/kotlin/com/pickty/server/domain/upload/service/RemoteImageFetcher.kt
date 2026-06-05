package com.pickty.server.domain.upload.service

import org.slf4j.LoggerFactory
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.awt.Color
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.URI
import java.time.Duration
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 외부 URL 이미지를 다운로드해 **장변 [maxEdge]px JPEG**로 재인코딩한다(프론트 업로드 압축과 동일 취지).
 *
 * 자동 생성 템플릿이 남의 서버 핫링크를 그대로 쓰면 표시 차단(403/ORB)·링크 로트 위험이 있어,
 * 받은 이미지를 압축해 [R2ImageStorageService.storeCompressedJpeg] 로 R2에 영속화하기 위한 전처리.
 * 추가 의존성 없이 JDK 표준 `javax.imageio` 만 사용한다.
 */
@Component
class RemoteImageFetcher {

    private val log = LoggerFactory.getLogger(javaClass)

    private val restClient = RestClient.builder()
        .defaultHeader("User-Agent", USER_AGENT)
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofSeconds(5))
                setReadTimeout(Duration.ofSeconds(10))
            },
        )
        .build()

    /** 다운로드+압축 성공 시 JPEG 바이트, 실패(네트워크·비이미지·디코딩 불가)면 null. */
    fun fetchAndCompressToJpeg(url: String, maxEdge: Int = DEFAULT_MAX_EDGE): ByteArray? {
        val u = url.trim()
        if (!u.startsWith("https://") && !u.startsWith("http://")) return null

        val raw = try {
            restClient.get().uri(URI.create(u)).retrieve().body(ByteArray::class.java)
        } catch (e: Exception) {
            log.warn("RemoteImageFetcher download failed url='{}': {}", u, e.message)
            return null
        }
        if (raw == null || raw.isEmpty() || raw.size > MAX_DOWNLOAD_BYTES) {
            return null
        }
        return compressToJpeg(raw, maxEdge)
    }

    private fun compressToJpeg(bytes: ByteArray, maxEdge: Int): ByteArray? {
        val src = try {
            ImageIO.read(ByteArrayInputStream(bytes))
        } catch (e: Exception) {
            null
        } ?: return null

        val w = src.width
        val h = src.height
        if (w <= 0 || h <= 0) return null

        val scale = min(1.0, maxEdge.toDouble() / max(w, h))
        val tw = max(1, (w * scale).roundToInt())
        val th = max(1, (h * scale).roundToInt())

        // JPEG는 알파 채널이 없으므로 흰 배경에 합성해 평탄화한다.
        val rgb = BufferedImage(tw, th, BufferedImage.TYPE_INT_RGB)
        val g = rgb.createGraphics()
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
            g.color = Color.WHITE
            g.fillRect(0, 0, tw, th)
            g.drawImage(src, 0, 0, tw, th, null)
        } finally {
            g.dispose()
        }

        return try {
            encodeJpeg(rgb)
        } catch (e: Exception) {
            log.warn("RemoteImageFetcher JPEG encode failed: {}", e.message)
            null
        }
    }

    private fun encodeJpeg(image: BufferedImage): ByteArray {
        val writer = ImageIO.getImageWritersByFormatName("jpeg").next()
        val param = writer.defaultWriteParam.apply {
            compressionMode = ImageWriteParam.MODE_EXPLICIT
            compressionQuality = JPEG_QUALITY
        }
        val out = ByteArrayOutputStream()
        ImageIO.createImageOutputStream(out).use { ios ->
            writer.output = ios
            writer.write(null, IIOImage(image, null, null), param)
        }
        writer.dispose()
        return out.toByteArray()
    }

    companion object {
        private const val USER_AGENT = "PicktyBot/1.0 (+https://pickty.app)"
        private const val DEFAULT_MAX_EDGE = 1024
        private const val JPEG_QUALITY = 0.8f
        private const val MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
    }
}
