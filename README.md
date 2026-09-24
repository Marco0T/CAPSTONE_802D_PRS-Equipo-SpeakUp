# Preparador de Pitch por Voz y Redacción

Sistema web que ayuda a estudiantes y personas con ansiedad social o del habla a practicar y mejorar sus discursos, presentaciones o entrevistas antes del momento real. A través del micrófono del navegador, escucha y transcribe en tiempo real lo que dice el usuario, y entrega un análisis con recomendaciones según la situación elegida.

## Descripción

- **¿Qué hace?** Escucha el pitch del usuario por voz, lo transcribe en tiempo real y analiza el discurso (cantidad de palabras, palabras de relleno, palabras repetidas), entregando recomendaciones para mejorar.
- **¿A quién va dirigido?** Estudiantes que preparan presentaciones, personas con ansiedad social o del habla, y cualquiera que quiera practicar antes de una entrevista o presentación real.
- **¿Qué problema resuelve?** La falta de un espacio accesible para ensayar un pitch y recibir feedback real antes del día de la presentación o entrevista.

## Funcionalidades principales

- Registro e inicio de sesión de usuarios (Django)
- Roles del sistema: **Administrador** y **Usuario**
- Selección de situación de uso: **Presentación** o **Entrevista**
- Reconocimiento de voz en tiempo real (español, `es-CL`)
- Transcripción en vivo de lo hablado
- Análisis del discurso: cantidad de palabras, palabras de relleno detectadas (*eh, em, mmm, bueno, este, o sea*), palabras repetidas con su conteo, y recomendación general
- Consejo personalizado según la situación seleccionada (presentación vs. entrevista)

## Tecnologías utilizadas

| Componente | Tecnología |
|---|---|
| Backend | Django (Python) |
| Base de datos | SQLite (por defecto de Django) |
| Frontend | HTML, CSS, JavaScript |
| Reconocimiento de voz | Web Speech API del navegador (`webkitSpeechRecognition`) — requiere un navegador compatible, como Google Chrome |

## Instrucciones para ejecutar el proyecto localmente

1. Clonar el repositorio.
2. Crear y activar un entorno virtual (recomendado).
3. Instalar dependencias:
   ```bash
   pip install django
   ```
4. Aplicar las migraciones de la base de datos:
   ```bash
   python manage.py migrate
   ```
5. (Opcional) Crear un superusuario para acceder a Django Administration:
   ```bash
   python manage.py createsuperuser
   ```
6. Levantar el servidor:
   ```bash
   python manage.py runserver
   ```
7. Abrir en el navegador (recomendado **Google Chrome**, por compatibilidad con el reconocimiento de voz):
   ```
   http://127.0.0.1:8000/
   ```

> **Nota:** por ahora el proyecto corre en entorno local. A futuro se planea desplegar en la red.

## Integrantes del equipo

| Integrante | Rol en el proyecto |
|---|---|
| Marco Toloza | Diseño de interfaz y documentación |
| Dante Sepulveda | Desarrollo backend y reconocimiento de voz |

## Metodología de trabajo

**Cascada (Waterfall):** el proyecto se desarrolla en fases secuenciales — Diseño, Desarrollo, Análisis y pruebas, Evolución — cada una con sus propios entregables y evaluación.

## Arquitectura de la solución

- El **frontend** (HTML/CSS/JS) captura el audio del usuario mediante el micrófono y usa la Web Speech API para transcribirlo en tiempo real.
- El texto transcrito se analiza en el navegador (cantidad de palabras, palabras de relleno, repeticiones) y entrega recomendaciones según la situación elegida.
- **Django** gestiona el registro, la autenticación y los roles de usuario (Administrador / Usuario), con **SQLite** como base de datos.
- *Evolución futura:* historial de sesiones guardado en base de datos, análisis más avanzado (IA), uso de cámara.
