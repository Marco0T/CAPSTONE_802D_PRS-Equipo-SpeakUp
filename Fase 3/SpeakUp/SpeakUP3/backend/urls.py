
from django.contrib import admin
from django.urls import path
from usuarios import views


urlpatterns = [

    # ==========================================
    # ADMINISTRACIÓN DE DJANGO
    # ==========================================

    path(
        "admin/",
        admin.site.urls
    ),

    # ==========================================
    # REGISTRO E INICIO DE SESIÓN
    # ==========================================

    path(
        "registro/",
        views.registro,
        name="registro"
    ),

    path(
        "login/",
        views.login,
        name="login"
    ),

    # ==========================================
    # PÁGINA PRINCIPAL DE SPEAKUP
    # ==========================================

    path(
        "voz/",
        views.voz,
        name="voz"
    ),

    # ==========================================
    # GUARDAR CONVERSACIÓN
    # ==========================================

    path(
        "guardar-conversacion/",
        views.guardar_conversacion,
        name="guardar_conversacion"
    ),

    # ==========================================
    # SPEAKUP3 - INTELIGENCIA ARTIFICIAL
    # ==========================================

    path(
        "mejorar-discurso/",
        views.mejorar_discurso,
        name="mejorar_discurso"
    ),

    # ==========================================
    # HISTORIAL DE CONVERSACIONES
    # ==========================================

    path(
        "historial/",
        views.historial,
        name="historial"
    ),

    # ==========================================
    # DETALLE DE UNA CONVERSACIÓN
    # ==========================================

    path(
        "historial/<int:conversacion_id>/",
        views.detalle_conversacion,
        name="detalle_conversacion"
    ),

    # ==========================================
    # ELIMINAR CONVERSACIÓN
    # ==========================================

    path(
        "historial/eliminar/<int:conversacion_id>/",
        views.eliminar_conversacion,
        name="eliminar_conversacion"
    ),

    # ==========================================
    # OTRAS RUTAS EXISTENTES
    # ==========================================

    path(
        "iniciar/",
        views.iniciar,
        name="iniciar"
    ),

    path(
        "cerrar-sesion/",
        views.cerrar_sesion,
        name="cerrar_sesion"
    ),

]
