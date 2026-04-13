package com.pickty.server.domain.view

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class ViewCountBatchScheduler(
    private val viewCountService: ViewCountService,
    private val viewCountBatchWriter: ViewCountBatchWriter,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "0 0/5 * * * *")
    fun flushViewCounts() {
        flushTemplates()
        flushResults()
    }

    private fun flushTemplates() {
        val drained = viewCountService.atomicDrain(ViewCountService.HASH_TEMPLATES)
        if (drained.isEmpty()) return
        try {
            viewCountBatchWriter.mergeTemplateViews(drained)
        } catch (ex: Exception) {
            viewCountService.restoreTemplateDeltas(drained)
            log.error("tier_templates view_count batch failed, restored Valkey deltas", ex)
        }
    }

    private fun flushResults() {
        val drained = viewCountService.atomicDrain(ViewCountService.HASH_RESULTS)
        if (drained.isEmpty()) return
        try {
            viewCountBatchWriter.mergeResultViews(drained)
        } catch (ex: Exception) {
            viewCountService.restoreResultDeltas(drained)
            log.error("tier_results view_count batch failed, restored Valkey deltas", ex)
        }
    }
}
