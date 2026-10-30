SPEAKUP2 + SEGUIMIENTO DE IA LOCAL (OLLAMA)

REQUISITOS
- Windows con Python y Django.
- Ollama: https://ollama.com/download/windows
- Modelo gratuito: qwen3:4b

INSTALACIÓN
1. Instala Ollama.
2. Abre PowerShell: ollama pull qwen3:4b
3. Verifica: ollama list
4. En la carpeta SpeakUP2 ejecuta:
   python -m pip install django
   python manage.py migrate
   python manage.py runserver
5. Entra a http://127.0.0.1:8000/login/
6. Inicia sesión y termina una práctica con voz. El seguimiento aparece en la página y en Historial > Detalle.

IMPORTANTE
- El análisis se ejecuta en el PC que corre Django, no en el navegador.
- No hay cargos por API, pero requiere RAM/CPU/GPU y puede tardar.
- Si Ollama no está disponible, la práctica SE GUARDA y se indica el fallo.
- Para llevar tus usuarios y prácticas antiguas, conserva TU archivo db.sqlite3 anterior.
  Esta distribución NO contiene bases de datos ni cuentas privadas.
- NO reemplaces tu base de datos existente con otra.
- Si no aparece el análisis, comprueba que Ollama esté funcionando y que qwen3:4b figure en ollama list.
- El servidor espera a la IA hasta 120 segundos. En equipos lentos puede tardar.
- Los modelos pueden equivocarse; compara los consejos con las transcripciones.
- Reconocimiento de voz: sigue dependiendo del navegador.
