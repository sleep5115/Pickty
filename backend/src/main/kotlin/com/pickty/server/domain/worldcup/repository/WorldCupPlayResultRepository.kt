package com.pickty.server.domain.worldcup.repository

import com.pickty.server.domain.worldcup.entity.WorldCupPlayResult
import org.springframework.data.jpa.repository.JpaRepository

interface WorldCupPlayResultRepository : JpaRepository<WorldCupPlayResult, Long>
