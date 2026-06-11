package com.pickty.server.domain.upload.support

import java.awt.Color
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 티어 템플릿 목록 카드용 2×2 콜라주 썸네일 JPEG 합성.
 *
 * 프론트 `template-thumbnail-composite.ts`(1024px 캔버스 · gap 4 · object-fit contain ·
 * slate 배경)의 서버측 미러. 자동 생성 템플릿이 아이템 1장을 썸네일로 쓰지 않고
 * 수동 생성과 동일한 콜라주 규칙을 따르게 한다. JDK 표준 `javax.imageio`만 사용.
 */
object Thumbnail2x2Composer {

    /** 디코딩 가능한 이미지 바이트 4개를 2×2 JPEG로 합성. 입력이 4개가 아니거나 디코딩 실패면 null. */
    fun composeJpeg(imageBytesList: List<ByteArray>): ByteArray? {
        if (imageBytesList.size != 4) return null
        val sources = ArrayList<BufferedImage>(4)
        for (bytes in imageBytesList) {
            val img = try {
                ImageIO.read(ByteArrayInputStream(bytes))
            } catch (e: Exception) {
                null
            } ?: return null
            if (img.width <= 0 || img.height <= 0) return null
            sources.add(img)
        }

        val cell = (SIZE - GAP) / 2
        val corners = listOf(
            0 to 0,
            cell + GAP to 0,
            0 to cell + GAP,
            cell + GAP to cell + GAP,
        )

        val canvas = BufferedImage(SIZE, SIZE, BufferedImage.TYPE_INT_RGB)
        val g = canvas.createGraphics()
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR)
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY)
            g.color = BG
            g.fillRect(0, 0, SIZE, SIZE)
            for (i in 0..3) {
                val (x, y) = corners[i]
                val src = sources[i]
                g.color = CELL_BG
                g.fillRect(x, y, cell, cell)
                // object-fit: contain — 셀 안에 전체가 들어가도록, 여백은 셀 배경색
                val r = min(cell.toDouble() / src.width, cell.toDouble() / src.height)
                val dw = max(1, (src.width * r).roundToInt())
                val dh = max(1, (src.height * r).roundToInt())
                g.drawImage(src, x + (cell - dw) / 2, y + (cell - dh) / 2, dw, dh, null)
            }
        } finally {
            g.dispose()
        }

        return try {
            encodeJpeg(canvas)
        } catch (e: Exception) {
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

    // 프론트 GRID_SIZE_PX 512 × CANVAS_DPR 2, GRID_GAP_PX 2 × DPR 미러
    private const val SIZE = 1024
    private const val GAP = 4
    private const val JPEG_QUALITY = 0.8f
    private val BG = Color(0xE2, 0xE8, 0xF0) // #e2e8f0
    private val CELL_BG = Color(0xF1, 0xF5, 0xF9) // #f1f5f9
}
