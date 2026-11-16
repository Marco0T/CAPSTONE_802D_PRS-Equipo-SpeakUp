
import json
import re

from django.conf import settings
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.hashers import make_password, check_password
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import ensure_csrf_cookie
from groq import Groq

from .models import Usuario, Conversacion


def registro(request):
    if request.method == "POST":
        nombre = request.POST.get("usuario")
        correo = request.POST.get("correo")
        contrasena = request.POST.get("contrasena")
        contrasena2 = request.POST.get("contrasena2")

        if not nombre or not correo or not contrasena:
            return render(
                request,
                "usuarios/registro.html",
                {"error": "Completa todos los campos."}
            )

        if contrasena != contrasena2:
            return render(
                request,
                "usuarios/registro.html",
                {"error": "Las contraseñas no coinciden."}
            )

        if Usuario.objects.filter(correo=correo).exists():
            return render(
                request,
                "usuarios/registro.html",
                {"error": "Este correo ya está registrado."}
            )

        Usuario.objects.create(
            nombre=nombre,
            correo=correo,
            contrasena=make_password(contrasena)
        )

        return render(
            request,
            "usuarios/registro.html",
            {"mensaje": "Usuario registrado correctamente."}
        )

    return render(request, "usuarios/registro.html")


def login(request):
    if request.method == "POST":
        correo = request.POST.get("correo", "").strip()
        contrasena = request.POST.get("contrasena", "")

        try:
            usuario = Usuario.objects.get(correo=correo)

            # Primero comprobamos las contraseñas protegidas
            # mediante los métodos de Django.
            contrasena_valida = check_password(
                contrasena,
                usuario.contrasena
            )

            # Compatibilidad temporal con cuentas antiguas
            # que guardaban la contraseña como texto plano.
            if not contrasena_valida:
                contrasena_valida = (
                    usuario.contrasena == contrasena
                )

                # Si coincide, actualizamos el almacenamiento
                # a un hash seguro.
                if contrasena_valida:
                    usuario.contrasena = make_password(contrasena)
                    usuario.save(update_fields=["contrasena"])

            if contrasena_valida:
                request.session.cycle_key()
                request.session["usuario_id"] = usuario.id
                request.session["usuario_nombre"] = usuario.nombre

                if usuario.rol == "admin":
                    return redirect("/admin/")

                return redirect("/voz/")

            return render(
                request,
                "usuarios/iniciar.html",
                {"error": "Correo o contraseña incorrectos."}
            )

        except Usuario.DoesNotExist:
            return render(
                request,
                "usuarios/iniciar.html",
                {"error": "Correo o contraseña incorrectos."}
            )

    return render(request, "usuarios/iniciar.html")


@ensure_csrf_cookie
def voz(request):
    if "usuario_id" not in request.session:
        return redirect("/login/")

    return render(
        request,
        "usuarios/pag_voz.html",
        {
            "nombre_usuario": request.session.get("usuario_nombre")
        }
    )


@require_POST
def guardar_conversacion(request):
    """
    Recibe la transcripción y los resultados de la práctica
    desde el JavaScript de la página de voz.
    """
    usuario_id = request.session.get("usuario_id")

    if not usuario_id:
        return JsonResponse(
            {"error": "Debes iniciar sesión."},
            status=401
        )

    try:
        usuario = Usuario.objects.get(id=usuario_id)
    except Usuario.DoesNotExist:
        request.session.flush()
        return JsonResponse(
            {"error": "La sesión de usuario ya no es válida."},
            status=401
        )

    import json

    try:
        datos = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Los datos enviados no son válidos."},
            status=400
        )

    transcripcion = datos.get("transcripcion", "")
    palabras_repetidas = datos.get("palabras_repetidas", {})
    fecha_inicio_texto = datos.get("fecha_inicio")
    fecha_inicio = parse_datetime(fecha_inicio_texto) if fecha_inicio_texto else None

    if not isinstance(transcripcion, str):
        return JsonResponse(
            {"error": "La transcripción debe ser texto."},
            status=400
        )

    if not isinstance(palabras_repetidas, dict):
        return JsonResponse(
            {"error": "Las palabras repetidas deben enviarse como objeto."},
            status=400
        )

    # La fecha enviada por el navegador puede ser inválida.
    # En ese caso, utilizamos la hora actual del servidor.
    if fecha_inicio is None:
        fecha_inicio = timezone.now()
    elif timezone.is_naive(fecha_inicio):
        fecha_inicio = timezone.make_aware(
            fecha_inicio,
            timezone.get_current_timezone()
        )

    # Evitar fechas futuras por errores del navegador.
    ahora = timezone.now()
    if fecha_inicio > ahora:
        fecha_inicio = ahora

    cantidad_palabras = len(transcripcion.split())

    palabras_relleno = datos.get("palabras_relleno", 0)
    if not isinstance(palabras_relleno, int) or palabras_relleno < 0:
        palabras_relleno = 0

    conversacion = Conversacion.objects.create(
        usuario=usuario,
        fecha_inicio=fecha_inicio,
        situacion=str(datos.get("situacion", "presentacion"))[:30],
        transcripcion=transcripcion,
        cantidad_palabras=cantidad_palabras,
        palabras_relleno=palabras_relleno,
        palabras_repetidas=palabras_repetidas,
        recomendacion=str(datos.get("recomendacion", "")),
        consejo_situacion=str(datos.get("consejo_situacion", ""))
    )

    return JsonResponse({
        "mensaje": "Conversación guardada correctamente.",
        "conversacion_id": conversacion.id
    }, status=201)


def historial(request):
    usuario_id = request.session.get("usuario_id")

    if not usuario_id:
        return redirect("/login/")

    conversaciones = Conversacion.objects.filter(
        usuario_id=usuario_id
    )

    return render(
        request,
        "usuarios/historial.html",
        {"conversaciones": conversaciones}
    )


def limpiar_markdown_feedback(texto):
    texto = str(texto or "").strip()

    texto = re.sub(r"^\s*(?:[-*+]|\d+[.)])\s+", "", texto)
    texto = re.sub(r"\*\*(.*?)\*\*", r"\1", texto)
    texto = re.sub(r"__(.*?)__", r"\1", texto)
    texto = re.sub(r"`([^`]+)`", r"\1", texto)
    texto = re.sub(r"^#{1,6}\s*", "", texto)

    return texto.strip()


def parsear_filas_feedback(texto):
    if not texto:
        return []

    contenido = str(texto).strip()

    if contenido.startswith("[") or contenido.startswith("{"):
        try:
            datos = json.loads(contenido)
            lista = datos if isinstance(datos, list) else datos.get("feedback", [])

            filas = []
            for item in lista:
                if not isinstance(item, dict):
                    continue

                momento = limpiar_markdown_feedback(
                    item.get("momento")
                    or item.get("tiempo")
                    or item.get("time")
                    or ""
                )
                senal = limpiar_markdown_feedback(
                    item.get("senal")
                    or item.get("señal")
                    or item.get("segmento")
                    or item.get("segment")
                    or item.get("discurso")
                    or ""
                )
                recomendacion = (
                    item.get("recomendacion")
                    or item.get("recommendation")
                    or item.get("correccion")
                    or item.get("correction")
                    or item.get("texto")
                    or ""
                )

                segmento = " · ".join(
                    parte for parte in (momento, senal) if parte
                ) or "Feedback general"

                if str(recomendacion).strip():
                    filas.append({
                        "segmento": segmento,
                        "recomendacion": limpiar_markdown_feedback(recomendacion)
                    })

            if filas:
                return filas
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    filas = []
    segmento_actual = "Feedback general"
    buffer = []

    def agregar_fila():
        recomendacion = " ".join(buffer).strip()
        if recomendacion:
            filas.append({
                "segmento": segmento_actual or "Feedback general",
                "recomendacion": recomendacion
            })
        buffer.clear()

    for linea in contenido.splitlines():
        linea = linea.strip()

        if not linea or linea.startswith("```"):
            continue

        if "|" in linea and re.fullmatch(r"\|?[\s:\-|]+\|?", linea):
            continue

        if "|" in linea:
            partes = [parte.strip() for parte in linea.split("|") if parte.strip()]

            if len(partes) >= 3:
                momento = limpiar_markdown_feedback(partes[0])
                senal = limpiar_markdown_feedback(partes[1])
                recomendacion = limpiar_markdown_feedback(" ".join(partes[2:]))

                es_encabezado = (
                    re.search(r"momento|tiempo", momento, re.IGNORECASE)
                    and re.search(r"se[ñn]al", senal, re.IGNORECASE)
                )

                if es_encabezado:
                    continue

                agregar_fila()
                if recomendacion:
                    filas.append({
                        "segmento": " · ".join(
                            parte for parte in (momento, senal) if parte
                        ) or "Feedback general",
                        "recomendacion": recomendacion
                    })
                continue

            if len(partes) >= 2:
                segmento = limpiar_markdown_feedback(partes[0])
                recomendacion = limpiar_markdown_feedback(" ".join(partes[1:]))

                es_encabezado = (
                    re.fullmatch(
                        r"(segmento(\s+del\s+discurso)?|discurso)",
                        segmento,
                        re.IGNORECASE
                    )
                    and re.search(r"recomendaci[oó]n", recomendacion, re.IGNORECASE)
                )

                if es_encabezado:
                    continue

                agregar_fila()
                if recomendacion:
                    filas.append({
                        "segmento": segmento or "Feedback general",
                        "recomendacion": recomendacion
                    })
                continue

        encabezado = re.match(r"^#{1,6}\s+(.+)$", linea)
        if encabezado:
            agregar_fila()
            segmento_actual = limpiar_markdown_feedback(encabezado.group(1))
            continue

        negrita = re.match(r"^\*\*(.+?)\*\*:?\s*$", linea)
        if negrita:
            agregar_fila()
            segmento_actual = limpiar_markdown_feedback(negrita.group(1))
            continue

        etiqueta = re.match(r"^([^:]{3,60}):\s+(.+)$", linea)
        if etiqueta:
            agregar_fila()
            filas.append({
                "segmento": limpiar_markdown_feedback(etiqueta.group(1)),
                "recomendacion": limpiar_markdown_feedback(etiqueta.group(2))
            })
            continue

        buffer.append(limpiar_markdown_feedback(linea))

    agregar_fila()

    if not filas:
        filas.append({
            "segmento": "Feedback general",
            "recomendacion": limpiar_markdown_feedback(contenido)
        })

    return filas


def detalle_conversacion(request, conversacion_id):
    usuario_id = request.session.get("usuario_id")

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
            "conversacion": conversacion,
            "recomendacion_filas": parsear_filas_feedback(
                conversacion.recomendacion
            ),
            "consejo_filas": parsear_filas_feedback(
                conversacion.consejo_situacion
            )
        }
    )


def iniciar(request):
    return render(request, "usuarios/iniciar.html")


def cerrar_sesion(request):
    request.session.flush()
    return redirect("/login/")

GROQ_SYSTEM_PROMPT = (
    "Eres un coach experto en lenguaje corporal, presencia escénica y pitch "
    "para SpeakUp. La práctica se graba SOLO en video, sin audio: analiza "
    "exclusivamente las señales visuales y el lenguaje corporal. Evalúa "
    "postura, contacto visual, movimiento de manos, desplazamiento, tensión "
    "y gestos que transmitan inseguridad. Usa como apoyo los eventos de "
    "movimiento detectados automáticamente, pero no inventes detalles que no "
    "puedan deducirse de ellos. "
    "Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta: "
    "{\"feedback\":[{\"momento\":\"mm:ss\","
    "\"senal\":\"Señal de inseguridad detectada\","
    "\"recomendacion\":\"Recomendación accionable del coach\"}]}. "
    "Incluye entre 3 y 6 filas ordenadas por tiempo, con recomendaciones "
    "concretas y prácticas. No uses Markdown, tablas, viñetas, bloques de "
    "código ni texto adicional fuera del JSON. Mantén un tono profesional, "
    "cercano y útil."
)


def ask_groq(request):
    if request.method != "POST":
        return JsonResponse(
            {"error": "Método no permitido."},
            status=405
        )

    try:
        datos = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {"error": "Los datos enviados no son válidos."},
            status=400
        )

    prompt = datos.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        return JsonResponse(
            {"error": "El parámetro 'prompt' es obligatorio."},
            status=400
        )

    if not settings.GROQ_API_KEY:
        return JsonResponse(
            {"error": "El servicio de feedback no está configurado."},
            status=503
        )

    try:
        cliente = Groq(api_key=settings.GROQ_API_KEY)
        respuesta = cliente.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )
        respuesta_texto = respuesta.choices[0].message.content
        return JsonResponse({"response": respuesta_texto})
    except Exception as error:
        print("Error al consultar Groq:", error)
        return JsonResponse(
            {"error": "No se pudo obtener una respuesta del asistente."},
            status=500
        )


@require_POST
def eliminar_conversacion(request, conversacion_id):

    usuario_id = request.session.get("usuario_id")

    if not usuario_id:
        return redirect("/login/")

    conversacion = get_object_or_404(
        Conversacion,
        id=conversacion_id,
        usuario_id=usuario_id
    )

    conversacion.delete()

    return redirect("/historial/")