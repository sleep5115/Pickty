package com.pickty.server.domain.view.scheduler

import com.pickty.server.domain.view.repository.ViewCountJdbcBulk
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class ViewCountBatchWriter(
    private val viewCountJdbcBulk: ViewCountJdbcBulk,
) {
    @Transactional
    fun mergeTemplateViews(deltas: Map<UUID, Long>) {
        viewCountJdbcBulk.mergeTemplateViews(deltas)
    }

    @Transactional
    fun mergeResultViews(deltas: Map<UUID, Long>) {
        viewCountJdbcBulk.mergeResultViews(deltas)
    }
}
