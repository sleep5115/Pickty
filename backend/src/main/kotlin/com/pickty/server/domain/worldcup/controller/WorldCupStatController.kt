package com.pickty.server.domain.worldcup.controller

import com.pickty.server.domain.worldcup.dto.WorldCupRankingRowResponse
import com.pickty.server.domain.worldcup.dto.WorldCupResultSubmitRequest
import com.pickty.server.domain.worldcup.service.WorldCupStatService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/worldcup/templates")
class WorldCupStatController(
    private val worldCupStatService: WorldCupStatService,
) {

    @PostMapping("/{templateId}/results")
    fun submitPlayResult(
        @PathVariable templateId: UUID,
        @RequestBody body: WorldCupResultSubmitRequest,
    ): ResponseEntity<Unit> {
        worldCupStatService.submitPlayResult(templateId, body)
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build()
    }

    @GetMapping("/{templateId}/ranking")
    fun ranking(
        @PathVariable templateId: UUID,
        @PageableDefault(size = 20) pageable: Pageable,
    ): ResponseEntity<Page<WorldCupRankingRowResponse>> =
        ResponseEntity.ok(worldCupStatService.ranking(templateId, pageable))
}
