package com.pickty.server.domain.worldcup.controller

import com.pickty.server.domain.worldcup.dto.WorldCupPlayResultRequest
import com.pickty.server.domain.worldcup.service.WorldCupPlayResultService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/worldcup")
class WorldCupPlayResultController(
    private val worldCupPlayResultService: WorldCupPlayResultService,
) {

    /** 한 판 플레이 종료 후 우승자·선택 이력·통계 델타 전송 — 이력 저장 및 통계 누적 */
    @PostMapping("/results")
    fun submitPlayResult(@RequestBody body: WorldCupPlayResultRequest): ResponseEntity<Unit> {
        worldCupPlayResultService.accept(body)
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }
}
