package com.pickty.server.global.util

import java.nio.charset.StandardCharsets
import java.security.MessageDigest

object Sha256Hex {
    fun hash(input: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val bytes = md.digest(input.toByteArray(StandardCharsets.UTF_8))
        return bytes.joinToString("") { b -> "%02x".format(b) }
    }
}
