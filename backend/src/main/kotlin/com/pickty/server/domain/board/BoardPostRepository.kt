package com.pickty.server.domain.board

import java.util.UUID
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface BoardPostRepository : JpaRepository<BoardPost, UUID> {
    fun findAllByStatusOrderByCreatedAtDesc(status: BoardPostStatus, pageable: Pageable): Page<BoardPost>

    fun findByIdAndStatus(id: UUID, status: BoardPostStatus): BoardPost?
}
