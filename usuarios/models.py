from django.db import models


# ==========================================
# MODELO DE USUARIO
# ==========================================

class Usuario(models.Model):

    nombre = models.CharField(max_length=100)

    correo = models.EmailField(unique=True)

    contrasena = models.CharField(max_length=100)

    rol = models.CharField(
        max_length=20,
        default="usuario"
    )

    def __str__(self):
        return self.nombre


# ==========================================
# MODELO DE CONVERSACIÓN
# ==========================================

class Conversacion(models.Model):

    # Usuario al que pertenece la práctica
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        related_name="conversaciones"
    )

    # Fechas de la práctica
    fecha_inicio = models.DateTimeField()

    fecha_fin = models.DateTimeField(
        auto_now_add=True
    )

    # Tipo de práctica
    situacion = models.CharField(
        max_length=30,
        default="presentacion"
    )

    # Transcripción del discurso
    transcripcion = models.TextField(
        blank=True
    )

    # Métricas del análisis
    cantidad_palabras = models.PositiveIntegerField(
        default=0
    )

    palabras_relleno = models.PositiveIntegerField(
        default=0
    )

    # Repeticiones consecutivas detectadas
    palabras_repetidas = models.JSONField(
        default=dict,
        blank=True
    )

    # ======================================
    # SEGUIMIENTO CON INTELIGENCIA ARTIFICIAL
    # ======================================

    # Evaluación y consejo generado por
    # Qwen2.5 o por el sistema de respaldo.
    seguimiento_ia = models.TextField(
        blank=True,
        default=""
    )

    # Estados:
    # pendiente: todavía no se ha analizado
    # completado: Ollama generó una respuesta válida
    # no_disponible: se utilizó el respaldo
    estado_ia = models.CharField(
        max_length=20,
        default="pendiente"
    )

    # Recomendaciones del análisis básico
    recomendacion = models.TextField(
        blank=True
    )

    consejo_situacion = models.TextField(
        blank=True
    )

    class Meta:

        # Mostrar primero las prácticas recientes
        ordering = ["-fecha_inicio"]

    def __str__(self):

        return (
            f"{self.usuario.nombre} - "
            f"{self.fecha_inicio:%Y-%m-%d %H:%M}"
        )