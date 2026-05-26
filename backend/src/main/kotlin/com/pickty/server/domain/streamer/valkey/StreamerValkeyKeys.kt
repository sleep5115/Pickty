package com.pickty.server.domain.streamer.valkey

import java.util.UUID

object StreamerValkeyKeys {

    const val ACTIVE_SESSIONS_SET = "streamer:sessions:active"

    fun sessionMeta(sessionId: UUID): String = "streamer:session:$sessionId"

    fun worldcupMatchVotes(sessionId: UUID, leftId: String, rightId: String): String =
        "streamer:session:$sessionId:match:${leftId}_$rightId"

    fun worldcupMatchVoters(sessionId: UUID, leftId: String, rightId: String): String =
        "streamer:session:$sessionId:voted-users:match:${leftId}_$rightId"

    fun quickVoteResults(sessionId: UUID): String =
        "streamer:session:$sessionId:quick-vote:results"

    fun quickVoteVoters(sessionId: UUID, itemId: String): String =
        "streamer:session:$sessionId:voted-users:quick-vote:$itemId"

    fun tierStatsItem(sessionId: UUID, itemId: String): String =
        "streamer:session:$sessionId:tier-stats:$itemId"

    fun tierSubmittedVoters(sessionId: UUID): String =
        "streamer:session:$sessionId:voted-users:tier-submit"

    fun sseTicket(ticketId: UUID): String = "streamer:sse-ticket:$ticketId"

    fun activeUsersMinute(sessionId: UUID, minuteToken: String): String =
        "streamer:session:$sessionId:active-users:$minuteToken"
}
