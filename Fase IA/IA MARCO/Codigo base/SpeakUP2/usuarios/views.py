
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.hashers import make_password, check_password
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import ensure_csrf_cookie

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
        {"conversacion": conversacion}
    )


def iniciar(request):
    return render(request, "usuarios/iniciar.html")


def cerrar_sesion(request):
    request.session.flush()
    return redirect("/login/")

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