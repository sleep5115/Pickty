package com.pickty.server.global.oauth2

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.util.Base64

object CookieUtils {

    fun getCookie(request: HttpServletRequest, name: String): Cookie? =
        request.cookies?.firstOrNull { it.name == name }

    fun addCookie(response: HttpServletResponse, name: String, value: String, maxAge: Int) {
        Cookie(name, value).apply {
            path = "/"
            isHttpOnly = true
            setMaxAge(maxAge)
        }.also { response.addCookie(it) }
    }

    fun deleteCookie(request: HttpServletRequest, response: HttpServletResponse, name: String) {
        request.cookies
            ?.filter { it.name == name }
            ?.forEach { cookie ->
                Cookie(cookie.name, "").apply {
                    path = "/"
                    setMaxAge(0)
                }.also { response.addCookie(it) }
            }
    }

    fun serialize(obj: Any): String =
        ByteArrayOutputStream().use { baos ->
            ObjectOutputStream(baos).use { it.writeObject(obj) }
            Base64.getUrlEncoder().encodeToString(baos.toByteArray())
        }

    fun <T> deserialize(cookie: Cookie, cls: Class<T>): T {
        val bytes = Base64.getUrlDecoder().decode(cookie.value)
        return ByteArrayInputStream(bytes).use { bais ->
            ObjectInputStream(bais).use { ois ->
                @Suppress("UNCHECKED_CAST")
                cls.cast(ois.readObject())
            }
        }
    }
}
