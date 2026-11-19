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

    # ======================================
    # USUARIO
    # ======================================

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        related_name="conversaciones"
    )

    # ======================================
    # FECHAS DE LA PRÁCTICA
    # ======================================

    fecha_inicio = models.DateTimeField()

    fecha_fin = models.DateTimeField(
        auto_now_add=True
    )

    # ======================================
    # TIPO DE PRÁCTICA
    # ======================================

    situacion = models.CharField(
        max_length=30,
        default="presentacion"
    )

    # ======================================
    # TRANSCRIPCIÓN DEL DISCURSO
    # ======================================

    transcripcion = models.TextField(
        blank=True
    )

    # ======================================
    # MÉTRICAS DEL ANÁLISIS VERBAL
    # ======================================

    cantidad_palabras = models.PositiveIntegerField(
        default=0
    )

    palabras_relleno = models.PositiveIntegerField(
        default=0
    )

    palabras_repetidas = models.JSONField(
        default=dict,
        blank=True
    )

    # ======================================
    # FASE 3 - ANÁLISIS VISUAL CON MEDIAPIPE
    # ======================================

    # Almacena las estadísticas obtenidas
    # mediante el análisis de la cámara.
    #
    # Ejemplos:
    # - Porcentaje de rostro visible
    # - Orientación aproximada de la cabeza
    # - Detección de hombros
    # - Movimientos de manos
    # - Métricas faciales adicionales
    #
    # Si el usuario no activa la cámara,
    # este campo permanece como un diccionario
    # vacío: {}.
    #
    # No se guardan imágenes ni videos.

    analisis_visual = models.JSONField(
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
    #
    # pendiente:
    # Todavía no se ha analizado.
    #
    # completado:
    # Ollama generó una respuesta válida.
    #
    # no_disponible:
    # Se utilizó el sistema de respaldo.

    estado_ia = models.CharField(
        max_length=20,
        default="pendiente"
    )

    # ======================================
    # RECOMENDACIONES BÁSICAS
    # ======================================

    recomendacion = models.TextField(
        blank=True
    )

    consejo_situacion = models.TextField(
        blank=True
    )

    # ======================================
    # CONFIGURACIÓN DEL MODELO
    # ======================================

    class Meta:

        # Mostrar primero las prácticas recientes

        ordering = ["-fecha_inicio"]

    # ======================================
    # REPRESENTACIÓN DE LA CONVERSACIÓN
    # ======================================

    def __str__(self):

        return (
            f"{self.usuario.nombre} - "
            f"{self.fecha_inicio:%Y-%m-%d %H:%M}"
        )