import json
import logging
import math
import re
import threading

from django.db import close_old_connections

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.hashers import make_password, check_password
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Usuario, Conversacion
from .seguimiento_ia import analizar_y_guardar, contar_marcadores


logger = logging.getLogger(__name__)


# ==================================================
# PÁGINA PRINCIPAL / LANDING PAGE
# ==================================================

def principal(request):
    return render(request, "usuarios/principal.html")


# ==================================================
# REGISTRO DE USUARIOS
# ==================================================

def registro(request):

    if request.method == "POST":

        nombre = request.POST.get("usuario", "").strip()
        correo = request.POST.get("correo", "").strip()
        contrasena = request.POST.get("contrasena", "")
        contrasena2 = request.POST.get("contrasena2", "")

        if not nombre or not correo or not contrasena:

            return render(
                request,
                "usuarios/registro.html",
                {
                    "error": "Completa todos los campos."
                }
            )

        if contrasena != contrasena2:

            return render(
                request,
                "usuarios/registro.html",
                {
                    "error": "Las contraseñas no coinciden."
                }
            )

        if Usuario.objects.filter(correo=correo).exists():

            return render(
                request,
                "usuarios/registro.html",
                {
                    "error": "Este correo ya está registrado."
                }
            )

        Usuario.objects.create(
            nombre=nombre,
            correo=correo,
            contrasena=make_password(contrasena)
        )

        return render(
            request,
            "usuarios/registro.html",
            {
                "mensaje": "Usuario registrado correctamente."
            }
        )

    return render(
        request,
        "usuarios/registro.html"
    )


# ==================================================
# INICIO DE SESIÓN
# ==================================================

def login(request):

    if request.method == "POST":

        correo = request.POST.get(
            "correo",
            ""
        ).strip()

        contrasena = request.POST.get(
            "contrasena",
            ""
        )

        try:

            usuario = Usuario.objects.get(
                correo=correo
            )

            contrasena_valida = check_password(
                contrasena,
                usuario.contrasena
            )

            # Compatibilidad con usuarios antiguos
            # que todavía tengan contraseñas sin hash.

            if not contrasena_valida:

                contrasena_valida = (
                    usuario.contrasena == contrasena
                )

                if contrasena_valida:

                    usuario.contrasena = make_password(
                        contrasena
                    )

                    usuario.save(
                        update_fields=["contrasena"]
                    )

            if contrasena_valida:

                request.session.cycle_key()

                request.session["usuario_id"] = usuario.id

                request.session["usuario_nombre"] = (
                    usuario.nombre
                )

                if usuario.rol == "admin":

                    return redirect("/admin/")

                return redirect("/voz/")

            return render(
                request,
                "usuarios/iniciar.html",
                {
                    "error": "Correo o contraseña incorrectos."
                }
            )

        except Usuario.DoesNotExist:

            return render(
                request,
                "usuarios/iniciar.html",
                {
                    "error": "Correo o contraseña incorrectos."
                }
            )

    return render(
        request,
        "usuarios/iniciar.html"
    )


# ==================================================
# PÁGINA DE PRÁCTICA
# ==================================================

@ensure_csrf_cookie
def voz(request):

    if "usuario_id" not in request.session:

        return redirect("/login/")

    return render(
        request,
        "usuarios/pag_voz.html",
        {
            "nombre_usuario": request.session.get(
                "usuario_nombre"
            )
        }
    )


# ==================================================
# CONTAR PALABRAS
# ==================================================

def contar_palabras(transcripcion):
    """
    Cuenta las palabras utilizando una expresión
    regular compatible con el análisis de JavaScript.

    No cuenta signos de puntuación como palabras.
    """

    return len(
        re.findall(
            r"[a-záéíóúüñ]+(?:['’][a-záéíóúüñ]+)?",
            transcripcion.lower()
        )
    )


# ==================================================
# FASE 3 - VALIDACIÓN DE DATOS DE MEDIAPIPE
# ==================================================

# Los nombres de estas métricas serán utilizados
# posteriormente por camara.js y seguimiento_ia.py.
#
# Cada porcentaje representa una estimación
# calculada a partir de los fotogramas analizados.
#
# No se reciben ni almacenan imágenes o videos.


METRICAS_PORCENTAJE = {
    "rostro_visible",
    "orientacion_frontal",
    "mirada_camara_estimada",
    "estabilidad_corporal",
    "hombros_visibles",
    "manos_visibles"
}


METRICAS_CONTADOR = {
    "movimientos_manos",
    "inclinaciones_cabeza",
    "cambios_orientacion_cabeza",
    "fotogramas_analizados"
}


def validar_porcentaje(valor):
    """
    Acepta números entre 0 y 100.

    Devuelve None cuando el dato no es válido.
    """

    if isinstance(valor, bool):
        return None

    if not isinstance(valor, (int, float)):
        return None

    if not math.isfinite(valor):
        return None

    if valor < 0 or valor > 100:
        return None

    return round(float(valor), 2)


def validar_contador(valor):
    """
    Acepta números enteros no negativos.
    """

    if isinstance(valor, bool):
        return None

    if not isinstance(valor, int):
        return None

    if valor < 0:
        return None

    return valor


def validar_analisis_visual(datos_visuales):
    """
    Valida las estadísticas recibidas
    desde el navegador.

    Si la cámara no se utilizó, devuelve {}.

    Los valores no válidos se descartan.

    Solo se guardan las métricas permitidas.
    """

    if not isinstance(datos_visuales, dict):
        return {}

    if not datos_visuales:
        return {}

    resultado = {}

    # ======================================
    # VALIDAR PORCENTAJES
    # ======================================

    for metrica in METRICAS_PORCENTAJE:

        if metrica not in datos_visuales:
            continue

        valor = validar_porcentaje(
            datos_visuales[metrica]
        )

        if valor is not None:
            resultado[metrica] = valor

    # ======================================
    # VALIDAR CONTADORES
    # ======================================

    for metrica in METRICAS_CONTADOR:

        if metrica not in datos_visuales:
            continue

        valor = validar_contador(
            datos_visuales[metrica]
        )

        if valor is not None:
            resultado[metrica] = valor

    # ======================================
    # INFORMACIÓN DE LA CÁMARA
    # ======================================

    # Una práctica solo se considera analizada
    # visualmente si se procesaron fotogramas.

    fotogramas = resultado.get(
        "fotogramas_analizados",
        0
    )

    if fotogramas <= 0:
        return {}

    resultado["camara_utilizada"] = True

    resultado["version_analisis"] = "mediapipe_fase3"

    return resultado


def _analizar_en_segundo_plano(conversacion_id):
    """Worker ligero para ejecución local. No requiere Celery ni Redis."""
    close_old_connections()
    try:
        conversacion = Conversacion.objects.get(pk=conversacion_id)
        analizar_y_guardar(conversacion)
    except Conversacion.DoesNotExist:
        logger.info("La conversación %s fue eliminada antes del análisis.", conversacion_id)
    except Exception:
        logger.exception("Error de análisis IA para conversación %s", conversacion_id)
        Conversacion.objects.filter(pk=conversacion_id).update(
            estado_ia="no_disponible",
            seguimiento_ia=(
                "Evaluación: La práctica se guardó, pero no fue posible completar "
                "el análisis de IA. Revisa tu transcripción y estadísticas."
            ),
        )
    finally:
        close_old_connections()


def estado_seguimiento(request, conversacion_id):
    """Consulta de estado restringida al propietario de la práctica."""
    usuario_id = request.session.get("usuario_id")
    if not usuario_id:
        return JsonResponse({"error": "Debes iniciar sesión."}, status=401)
    conversacion = get_object_or_404(
        Conversacion, pk=conversacion_id, usuario_id=usuario_id
    )
    return JsonResponse({
        "estado_ia": conversacion.estado_ia,
        "seguimiento_ia": conversacion.seguimiento_ia,
    })


# ==================================================
# GUARDAR CONVERSACIÓN
# ==================================================

@require_POST
def guardar_conversacion(request):
    """
    Guarda una práctica y ejecuta el seguimiento
    personalizado con Qwen2.5 mediante Ollama.

    La conversación se guarda antes del análisis
    para conservarla si la IA falla.

    Fase 3:
    También recibe estadísticas visuales
    calculadas por MediaPipe en el navegador.
    """

    usuario_id = request.session.get(
        "usuario_id"
    )

    if not usuario_id:

        return JsonResponse(
            {
                "error": "Debes iniciar sesión."
            },
            status=401
        )

    try:

        usuario = Usuario.objects.get(
            id=usuario_id
        )

    except Usuario.DoesNotExist:

        request.session.flush()

        return JsonResponse(
            {
                "error": "La sesión de usuario ya no es válida."
            },
            status=401
        )

    # ==========================================
    # RECIBIR DATOS DEL NAVEGADOR
    # ==========================================

    try:

        datos = json.loads(
            request.body
        )

    except (
        json.JSONDecodeError,
        UnicodeDecodeError
    ):

        return JsonResponse(
            {
                "error": "Los datos enviados no son válidos."
            },
            status=400
        )

    if not isinstance(datos, dict):

        return JsonResponse(
            {
                "error": "El formato de los datos no es válido."
            },
            status=400
        )

    # ==========================================
    # VALIDAR TRANSCRIPCIÓN
    # ==========================================

    transcripcion = datos.get(
        "transcripcion",
        ""
    )

    if not isinstance(transcripcion, str):

        return JsonResponse(
            {
                "error": "La transcripción debe ser texto."
            },
            status=400
        )

    transcripcion = transcripcion.strip()

    if not transcripcion:

        return JsonResponse(
            {
                "error": "No se puede guardar una práctica vacía."
            },
            status=400
        )

    # ==========================================
    # VALIDAR SITUACIÓN
    # ==========================================

    situacion = datos.get(
        "situacion",
        "presentacion"
    )

    if situacion not in (
        "presentacion",
        "entrevista"
    ):

        situacion = "presentacion"

    # ==========================================
    # VALIDAR FECHA DE INICIO
    # ==========================================

    fecha_inicio_texto = datos.get(
        "fecha_inicio"
    )

    fecha_inicio = None

    if isinstance(fecha_inicio_texto, str):

        fecha_inicio = parse_datetime(
            fecha_inicio_texto
        )

    if fecha_inicio is None:

        fecha_inicio = timezone.now()

    elif timezone.is_naive(fecha_inicio):

        fecha_inicio = timezone.make_aware(
            fecha_inicio,
            timezone.get_current_timezone()
        )

    ahora = timezone.now()

    if fecha_inicio > ahora:

        fecha_inicio = ahora

    # ==========================================
    # CALCULAR CANTIDAD DE PALABRAS
    # ==========================================

    cantidad_palabras = contar_palabras(
        transcripcion
    )

    # ==========================================
    # VALIDAR MULETILLAS
    # ==========================================

    # Calculamos las posibles muletillas en Python
    # para no depender únicamente de los datos
    # enviados por JavaScript.

    marcadores = contar_marcadores(
        transcripcion
    )

    palabras_relleno = sum(
        marcadores.values()
    )

    # ==========================================
    # VALIDAR PALABRAS REPETIDAS
    # ==========================================

    palabras_repetidas = datos.get(
        "palabras_repetidas",
        {}
    )

    if not isinstance(palabras_repetidas, dict):

        palabras_repetidas = {}

    # ==========================================
    # RECOMENDACIONES BÁSICAS
    # ==========================================

    recomendacion = datos.get(
        "recomendacion",
        ""
    )

    consejo_situacion = datos.get(
        "consejo_situacion",
        ""
    )

    if not isinstance(recomendacion, str):

        recomendacion = ""

    if not isinstance(consejo_situacion, str):

        consejo_situacion = ""

    # ==========================================
    # FASE 3 - RECIBIR ANÁLISIS VISUAL
    # ==========================================

    datos_visuales_recibidos = datos.get(
        "analisis_visual",
        {}
    )

    analisis_visual = validar_analisis_visual(
        datos_visuales_recibidos
    )

    if analisis_visual:

        logger.info(
            "Práctica con análisis visual. "
            "Fotogramas analizados: %s",
            analisis_visual.get(
                "fotogramas_analizados",
                0
            )
        )

    else:

        logger.info(
            "Práctica sin análisis visual."
        )

    # ==========================================
    # GUARDAR EN BASE DE DATOS
    # ==========================================

    conversacion = Conversacion.objects.create(

        usuario=usuario,

        fecha_inicio=fecha_inicio,

        situacion=situacion,

        transcripcion=transcripcion,

        cantidad_palabras=cantidad_palabras,

        palabras_relleno=palabras_relleno,

        palabras_repetidas=palabras_repetidas,

        recomendacion=recomendacion,

        consejo_situacion=consejo_situacion,

        # NUEVO CAMPO DE MEDIAPIPE

        analisis_visual=analisis_visual

    )

    # ==========================================
    # INICIAR IA EN SEGUNDO PLANO (DESARROLLO LOCAL)
    # ==========================================
    conversacion.estado_ia = "pendiente"
    conversacion.seguimiento_ia = ""
    conversacion.save(update_fields=["estado_ia", "seguimiento_ia"])

    threading.Thread(
        target=_analizar_en_segundo_plano,
        args=(conversacion.pk,),
        daemon=True,
        name=f"SpeakUP-IA-{conversacion.pk}",
    ).start()

    # ==========================================
    # DEVOLVER RESULTADO AL NAVEGADOR
    # ==========================================

    return JsonResponse(
        {
            "mensaje": "Conversación guardada correctamente.",

            "conversacion_id": conversacion.id,

            "seguimiento_ia": conversacion.seguimiento_ia,

            "estado_ia": conversacion.estado_ia,

            "cantidad_palabras": conversacion.cantidad_palabras,

            "palabras_relleno": conversacion.palabras_relleno,

            # FASE 3 - RESULTADOS VISUALES

            "analisis_visual": conversacion.analisis_visual,

            "camara_utilizada": bool(
                conversacion.analisis_visual
            )
        },
        status=201
    )


# ==================================================
# HISTORIAL DE CONVERSACIONES
# ==================================================

def historial(request):

    usuario_id = request.session.get(
        "usuario_id"
    )

    if not usuario_id:

        return redirect("/login/")

    conversaciones = Conversacion.objects.filter(
        usuario_id=usuario_id
    )

    return render(
        request,
        "usuarios/historial.html",
        {
            "conversaciones": conversaciones
        }
    )


# ==================================================
# DETALLE DE CONVERSACIÓN
# ==================================================

def detalle_conversacion(
    request,
    conversacion_id
):

    usuario_id = request.session.get(
        "usuario_id"
    )

    if not usuario_id:

        return redirect("/login/")

    conversacion = get_object_or_404(
        Conversacion,
        id=conversacion_id,
        usuario_id=usuario_id
    )

    return render(
        request,
        "usuarios/detalle_conversacion.html",
        {
            "conversacion": conversacion
        }
    )


# ==================================================
# PÁGINA DE INICIO DE SESIÓN
# ==================================================

def iniciar(request):

    return render(
        request,
        "usuarios/iniciar.html"
    )


# ==================================================
# CERRAR SESIÓN
# ==================================================

def cerrar_sesion(request):

    request.session.flush()

    return redirect("/login/")


# ==================================================
# ELIMINAR CONVERSACIÓN
# ==================================================

@require_POST
def eliminar_conversacion(
    request,
    conversacion_id
):

    usuario_id = request.session.get(
        "usuario_id"
    )

    if not usuario_id:

        return redirect("/login/")

    conversacion = get_object_or_404(
        Conversacion,
        id=conversacion_id,
        usuario_id=usuario_id
    )

    conversacion.delete()

    return redirect("/historial/")