import json
import logging
import re

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.hashers import make_password, check_password
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Usuario, Conversacion
from .seguimiento_ia import analizar_y_guardar


logger = logging.getLogger(__name__)


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
# GUARDAR CONVERSACIÓN
# ==================================================

@require_POST
def guardar_conversacion(request):
    """
    Guarda una práctica y ejecuta el seguimiento
    personalizado con Qwen2.5 mediante Ollama.

    La conversación se guarda antes del análisis
    para conservarla si la IA falla.
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

    from .seguimiento_ia import contar_marcadores

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

        consejo_situacion=consejo_situacion

    )

    # ==========================================
    # EJECUTAR SEGUIMIENTO CON IA
    # ==========================================

    try:

        analizar_y_guardar(
            conversacion
        )

    except Exception:

        # No eliminar la práctica si ocurre
        # un error inesperado en el seguimiento.

        logger.exception(
            "Error inesperado al analizar "
            "la conversación %s",
            conversacion.pk
        )

        conversacion.seguimiento_ia = (
            "Evaluación: Tu práctica fue guardada "
            "correctamente, pero no fue posible "
            "completar el seguimiento en este momento.\n\n"
            "Consejo: Continúa practicando y revisa "
            "tu transcripción para identificar "
            "aspectos que puedas mejorar."
        )

        conversacion.estado_ia = "no_disponible"

        conversacion.save(
            update_fields=[
                "seguimiento_ia",
                "estado_ia"
            ]
        )

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

            "palabras_relleno": conversacion.palabras_relleno
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