
from django.contrib import admin
from django.urls import path
from usuarios import views


urlpatterns = [
    # Administración de Django
    path("admin/", admin.site.urls),

    # Registro e inicio de sesión
    path("registro/", views.registro, name="registro"),
    path("login/", views.login, name="login"),

    # Página principal de reconocimiento de voz
    path("voz/", views.voz, name="voz"),

    # Guardar una conversación desde JavaScript
    path(
        "guardar-conversacion/",
        views.guardar_conversacion,
        name="guardar_conversacion"
    ),

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
