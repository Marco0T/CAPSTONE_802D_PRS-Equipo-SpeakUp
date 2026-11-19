
from django.contrib import admin
from django.urls import path
from usuarios import views


urlpatterns = [
    # Página principal de bienvenida
    path("", views.principal, name="principal"),

    # Administración de Django
    path("admin/", admin.site.urls),

    # Registro e inicio de sesión
    path("registro/", views.registro, name="registro"),
    path("login/", views.login, name="login"),

    # Página principal de reconocimiento de voz (entrevista laboral)
    path("voz/", views.voz, name="voz"),

    # Presentación trasladada desde SpeakUP2
    path(
        "voz-presentacion/",
        views.voz_presentacion,
        name="voz_presentacion"
    ),

    # Feedback con Groq para el modo presentación
    path(
        "api/ask-presentacion/",
        views.ask_groq_presentacion,
        name="ask_groq_presentacion"
    ),

    # Guardar una conversación desde JavaScript
    path(
        "guardar-conversacion/",
        views.guardar_conversacion,
        name="guardar_conversacion"
    ),

    # Guardar una conversación del modo presentación
    path(
        "guardar-conversacion-presentacion/",
        views.guardar_conversacion_presentacion,
        name="guardar_conversacion_presentacion"
    ),

    path("estado-seguimiento/<int:conversacion_id>/", views.estado_seguimiento, name="estado_seguimiento"),

    # Historial de conversaciones del usuario
    path(
        "historial/",
        views.historial,
        name="historial"
    ),

    # Detalle de una conversación específica
    path(
        "historial/<int:conversacion_id>/",
        views.detalle_conversacion,
        name="detalle_conversacion"
    ),

    # Otras rutas existentes
    path("iniciar/", views.iniciar, name="iniciar"),
    path("cerrar-sesion/", views.cerrar_sesion, name="cerrar_sesion"),

    path(
    "historial/eliminar/<int:conversacion_id>/",
    views.eliminar_conversacion,
    name="eliminar_conversacion"
),
]
