package com.pickty.server.domain.view.repository

import org.springframework.stereotype.Component
import java.sql.Connection
import java.util.UUID
import javax.sql.DataSource

@Component
class ViewCountJdbcBulk(
    private val dataSource: DataSource,
) {
    fun mergeTemplateViews(deltas: Map<UUID, Long>) = mergeTable("tier_templates", deltas)

    fun mergeResultViews(deltas: Map<UUID, Long>) = mergeTable("tier_results", deltas)

    private fun mergeTable(table: String, deltas: Map<UUID, Long>) {
        if (deltas.isEmpty()) return
        val ids = deltas.keys.toTypedArray()
        val incs = LongArray(deltas.size) { i -> deltas[ids[i]]!! }
        dataSource.connection.use { conn ->
            mergeWithConnection(conn, table, ids, incs)
        }
    }

    private fun mergeWithConnection(conn: Connection, table: String, ids: Array<UUID>, incs: LongArray) {
        val uuidArr = conn.createArrayOf("uuid", ids)
        val bigintArr = conn.createArrayOf("bigint", incs.toTypedArray())
        val sql =
            """
            UPDATE $table AS t
            SET view_count = t.view_count + v.inc,
                updated_at = now()
            FROM unnest(?::uuid[], ?::bigint[]) AS v(id, inc)
            WHERE t.id = v.id
            """.trimIndent()
        conn.prepareStatement(sql).use { ps ->
            ps.setArray(1, uuidArr)
            ps.setArray(2, bigintArr)
            ps.executeUpdate()
        }
    }
}