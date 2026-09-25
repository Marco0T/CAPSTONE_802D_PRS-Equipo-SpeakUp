from django.shortcuts import render, redirect
from django.contrib.auth.hashers import make_password, check_password

from .models import Usuario


def registro(request):

    if request.method == "POST":

        nombre = request.POST.get("usuario")
        correo = request.POST.get("correo")
        contrasena = request.POST.get("contrasena")
        contrasena2 = request.POST.get("contrasena2")

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

        return redirect("/iniciar/")

        return render(
            request,
            "usuarios/registro.html",
            {
                "mensaje": "Usuario registrado correctamente."
            }
        )

    return render(request, "usuarios/registro.html")


def login(request):

    if request.method == "POST":

        correo = request.POST.get("correo")
        contrasena = request.POST.get("contrasena")

        try:

            usuario = Usuario.objects.get(correo=correo)

            # Intentar comprobar contraseña protegida
            if check_password(contrasena, usuario.contrasena):

                # Contraseña correcta
                request.session["usuario_id"] = usuario.id
                request.session["usuario_nombre"] = usuario.nombre

                if usuario.rol == "admin":
                    return redirect("/admin/")

                return redirect("/voz/")

            # Compatibilidad con usuarios antiguos
            elif usuario.contrasena == contrasena:

                # Convertir la contraseña antigua a una contraseña protegida
                usuario.contrasena = make_password(contrasena)
                usuario.save()

                request.session["usuario_id"] = usuario.id
                request.session["usuario_nombre"] = usuario.nombre

                if usuario.rol == "admin":
                    return redirect("/admin/")

                return redirect("/voz/")

            else:

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

    return render(request, "usuarios/iniciar.html")


def voz(request):

    if "usuario_id" not in request.session:
        return redirect("/login/")

    nombre_usuario = request.session.get("usuario_nombre")

    return render(
        request,
        "usuarios/pag_voz.html",
        {
            "nombre_usuario": nombre_usuario
        }
    )


def iniciar(request):

    return render(
        request,
        "usuarios/iniciar.html"
    )


def cerrar_sesion(request):

    request.session.flush()

    return redirect("/login/")
