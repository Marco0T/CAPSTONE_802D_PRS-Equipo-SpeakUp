from django.db import models


class Usuario(models.Model):

    nombre = models.CharField(max_length=100)

    correo = models.EmailField(unique=True)

    contrasena = models.CharField(max_length=100)

    rol = models.CharField(max_length=20, default="usuario")

    def __str__(self):
        return self.nombre