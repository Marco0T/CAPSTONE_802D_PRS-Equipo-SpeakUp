# SpeakUP — Preparador de Pitch por Voz y Redacción

**Proyecto CAPSTONE | Fase 2**

SpeakUP es una aplicación web desarrollada para ayudar a estudiantes y otras personas a practicar sus habilidades de comunicación oral antes de una presentación o entrevista laboral.

El sistema permite reconocer y transcribir la voz del usuario, analizar características del discurso y entregar recomendaciones para mejorar su expresión verbal. Además, almacena las prácticas realizadas para que puedan consultarse posteriormente.

## 1. Descripción del proyecto

**¿Qué hace SpeakUP?**

Permite practicar discursos mediante el micrófono del navegador, visualizar una transcripción y obtener un análisis que considera la cantidad de palabras, las muletillas y las repeticiones detectadas.

**¿A quién está dirigido?**

Principalmente a estudiantes que preparan exposiciones, personas que desean mejorar su seguridad al hablar y usuarios que necesitan practicar entrevistas laborales.

**¿Qué problema busca resolver?**

La dificultad de practicar una exposición y recibir retroalimentación inmediata sobre algunos aspectos del discurso, sin depender necesariamente de otra persona para realizar la evaluación.

## 2. Funcionalidades implementadas

- Registro e inicio de sesión de usuarios.
- Cierre de sesión.
- Selección entre presentación y entrevista laboral.
- Reconocimiento de voz mediante la Web Speech API.
- Transcripción del discurso en español de Chile (`es-CL`).
- Conteo de palabras.
- Detección de palabras de relleno o muletillas.
- Identificación de palabras repetidas.
- Generación de recomendaciones basadas en reglas.
- Consejos según la situación seleccionada.
- Guardado de prácticas al detener el micrófono.
- Historial de conversaciones en «Mi progreso».
- Consulta del detalle de una práctica.
- Eliminación de prácticas guardadas.

El proyecto también utiliza las herramientas de administración incorporadas en Django. El acceso al panel administrativo es independiente del inicio de sesión personalizado de SpeakUP.

## 3. Tecnologías utilizadas

| Componente | Tecnología |
|---|---|
| Lenguaje principal | Python |
| Backend | Django |
| Frontend | HTML, CSS y JavaScript |
| Base de datos | SQLite |
| Reconocimiento de voz | Web Speech API |
| Navegador recomendado | Google Chrome |
| Idioma del reconocimiento | Español de Chile (`es-CL`) |
| Control de versiones | Git y GitHub |

El análisis de palabras y la generación de recomendaciones se realizan mediante reglas programadas en JavaScript. La versión actual no utiliza un modelo de inteligencia artificial para evaluar el discurso.

## 4. Arquitectura del sistema

SpeakUP utiliza una arquitectura web organizada en tres componentes principales.

**Frontend:** presenta la interfaz, permite controlar el micrófono, muestra la transcripción y ejecuta el análisis del discurso mediante JavaScript.

**Backend:** desarrollado con Django, gestiona los usuarios, las sesiones y las operaciones relacionadas con las prácticas almacenadas.

**Base de datos:** SQLite almacena la información de los usuarios y las conversaciones registradas.

### Flujo de funcionamiento

1. El usuario inicia sesión.
2. Selecciona una situación de práctica.
3. Activa el micrófono.
4. El navegador reconoce y transcribe el discurso.
5. JavaScript calcula las métricas y genera recomendaciones.
6. Al detener el micrófono, los resultados se envían a Django.
7. Django registra la práctica en SQLite.
8. El usuario puede consultar los resultados desde «Mi progreso».

## 5. Modelo de datos

La aplicación utiliza dos modelos principales:

**Usuario**

Almacena los datos necesarios para identificar a los usuarios registrados, incluyendo nombre, correo, contraseña protegida mediante hash y rol.

**Conversacion**

Almacena las prácticas realizadas, incluyendo usuario asociado, fecha de inicio, fecha de término, situación, transcripción, cantidad de palabras, palabras de relleno, palabras repetidas y recomendaciones.

La relación entre ambos modelos es de uno a muchos: un usuario puede tener varias conversaciones registradas.

## 6. Organización del proyecto

El sistema está desarrollado con Django y utiliza:

- `backend/`: configuración principal del proyecto Django.
- `usuarios/`: aplicación responsable de usuarios y conversaciones.
- `usuarios/models.py`: definición de los modelos de datos.
- `usuarios/views.py`: lógica de las vistas y operaciones del sistema.
- Plantillas HTML: interfaces de acceso, práctica e historial.
- Archivos CSS y JavaScript: estilos, interacción y análisis del discurso.
- SQLite: almacenamiento local de información.

## 7. Instalación y ejecución local

### Requisitos previos

- Python instalado.
- Git instalado, para clonar el repositorio.
- Google Chrome u otro navegador compatible con reconocimiento de voz.
- Micrófono funcional.
- Conexión a Internet cuando sea requerida por el servicio de reconocimiento del navegador.

### Pasos de instalación

**1. Clonar el repositorio**

```bash
git clone URL_DEL_REPOSITORIO
```

**2. Acceder a la carpeta del proyecto Django**

Ubicarse en el directorio que contiene `manage.py`.

**3. Crear un entorno virtual**

```bash
python -m venv venv
```

En Windows:

```bash
venv\Scripts\activate
```

**4. Instalar las dependencias**

Si el proyecto dispone de `requirements.txt`:

```bash
pip install -r requirements.txt
```

De lo contrario, para la configuración básica actual:

```bash
pip install django
```

**5. Aplicar las migraciones**

```bash
python manage.py migrate
```

**6. Iniciar el servidor**

```bash
python manage.py runserver
```

**7. Acceder a SpeakUP**

Abrir el navegador e ingresar a:

```text
http://127.0.0.1:8000/
```

### Administración de Django

Para crear un superusuario:

```bash
python manage.py createsuperuser
```

El panel administrativo se encuentra normalmente en:

```text
http://127.0.0.1:8000/admin/
```

La disponibilidad de cada modelo en el panel depende de su registro en la configuración administrativa de Django.

## 8. Metodología de desarrollo

El proyecto utiliza la metodología **Cascada (Waterfall)**, organizada en cuatro etapas de trabajo:

1. **Diseño:** definición del problema, objetivos, funcionalidades y propuesta de interfaz.
2. **Desarrollo:** implementación de las pantallas, reconocimiento de voz, autenticación y almacenamiento.
3. **Análisis y pruebas:** comprobación manual de funcionalidades, revisión de resultados y corrección de errores.
4. **Evolución:** incorporación de mejoras y planificación de funcionalidades posteriores.

La documentación del proyecto incluye roadmap, modelo de base de datos, evidencias de metodología, arquitectura, historias de usuario, backlog, casos de uso y modelo arquitectónico 4+1.

## 9. Evidencias del proyecto

Durante el desarrollo se han obtenido evidencias visuales de:

- Pantalla de inicio de sesión.
- Interfaz de práctica de voz.
- Transcripción y resultados del análisis.
- Confirmación del guardado de una práctica.
- Historial «Mi progreso».
- Detalle de una conversación almacenada.

Estas evidencias forman parte de la documentación de la Fase 2.

## 10. Limitaciones actuales

- El sistema se ejecuta en un entorno local de desarrollo.
- El reconocimiento de voz depende de la compatibilidad y el comportamiento del navegador.
- La continuidad del reconocimiento durante exposiciones prolongadas requiere pruebas adicionales.
- El análisis actual se basa en reglas y métricas textuales; no evalúa directamente la postura, los gestos ni el lenguaje corporal.
- La aplicación todavía no dispone de un despliegue público de producción.

## 11. Mejoras futuras

- Integración de cámara para analizar postura y lenguaje corporal.
- Evaluación de técnicas de análisis más avanzadas.
- Mejoras de seguridad y preparación para despliegue.
- Optimización de la interfaz.
- Ampliación de pruebas y documentación técnica.

Estas funcionalidades se consideran propuestas de evolución y no forman parte de las capacidades implementadas actualmente.

## 12. Integrantes del equipo

| Integrante | Responsabilidades |
|---|---|
| Marco Toloza | Diseño de interfaz y documentación |
| Dante Sepúlveda | Desarrollo backend y reconocimiento de voz |

## 13. Estado del proyecto

**Fase actual:** Fase 2 — desarrollo y documentación.

SpeakUP cuenta con una versión funcional en entorno local que permite registrar usuarios, practicar discursos, analizar transcripciones y consultar conversaciones almacenadas.

El desarrollo continúa con actividades de verificación, documentación y planificación de mejoras.
