
from django.db import models


class Usuario(models.Model):
    nombre = models.CharField(max_length=100)
    correo = models.EmailField(unique=True)
    contrasena = models.CharField(max_length=100)
    rol = models.CharField(max_length=20, default="usuario")

    def __str__(self):
        return self.nombre


class Conversacion(models.Model):
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        related_name="conversaciones"
    )

    fecha_inicio = models.DateTimeField()
    fecha_fin = models.DateTimeField(auto_now_add=True)

    situacion = models.CharField(
        max_length=30,
        default="presentacion"
    )

    transcripcion = models.TextField(blank=True)

    cantidad_palabras = models.PositiveIntegerField(default=0)
    palabras_relleno = models.PositiveIntegerField(default=0)

    palabras_repetidas = models.JSONField(
        default=dict,
        blank=True
    )

    recomendacion = models.TextField(blank=True)
    consejo_situacion = models.TextField(blank=True)

    class Meta:
        ordering = ["-fecha_inicio"]

    def __str__(self):
        return (
            f"{self.usuario.nombre} - "
            f"{self.fecha_inicio:%Y-%m-%d %H:%M}"
        )
