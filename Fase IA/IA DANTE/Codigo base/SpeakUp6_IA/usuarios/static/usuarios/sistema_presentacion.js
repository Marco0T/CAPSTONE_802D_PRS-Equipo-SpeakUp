/* ============================= */
/* ELEMENTOS */
/* ============================= */

const botonAccion = document.getElementById("accionPractica");

const estado = document.getElementById("estado");
const modalFeedback = document.getElementById("modalFeedback");
const cerrarFeedback = document.getElementById("cerrarFeedback");
const contenidoFeedback = document.getElementById("contenidoFeedback");

const reproductorResultado = document.getElementById("reproductorResultado");
const videoResultado = document.getElementById("videoResultado");
const descargarVideo = document.getElementById("descargarVideo");

const moduloCamara = document.getElementById("moduloCamara");
const videoCamara = document.getElementById("videoCamara");
const camaraEstado = document.getElementById("camaraEstado");
const alertaMovimiento = document.getElementById("alertaMovimiento");
const placeholderCamara = document.getElementById("placeholderCamara");

const tiempoPracticaEl = document.getElementById("tiempoPractica");
const alertasPracticaEl = document.getElementById("alertasPractica");
const resumenVivo = document.getElementById("resumenVivo");

const transcripcionTexto = document.getElementById("transcripcionTexto");
const transcripcionEstado = document.getElementById("transcripcionEstado");

const situaciones = document.getElementsByName("situacion");

/* ============================= */
/* ESTADO */
/* ============================= */

let flujoCamara = null;
let camaraIniciando = false;
let grabadoraVideo = null;
let fragmentosVideo = [];
let urlVideoActual = null;

let practicando = false;
let finalizando = false;
let guardando = false;
let fechaInicio = null;
let fechaFin = null;

let intervaloReloj = null;
let eventosCorporales = [];
let ultimoEventoMs = 0;

let reconocimientoVoz = null;
let transcripcionActiva = false;
let transcripcionFinal = "";
let transcripcionInterina = "";
let temporizadorReinicioVoz = null;
let mensajeTranscripcionVacio =
    "Aquí verás tus palabras mientras presentas.";

const canvasMovimiento = document.createElement("canvas");
canvasMovimiento.width = 96;
canvasMovimiento.height = 72;

const contextoMovimiento = canvasMovimiento.getContext("2d", {
    willReadFrequently: true
});

let intervaloMovimiento = null;
let cuadroAnterior = null;
let puntajeMovimiento = 0;
let inicioMovimientoAlto = null;
let inicioCalma = null;
let alertaMovimientoVisible = false;
let inicioDeteccion = 0;

const UMBRAL_MOVIMIENTO_ALTO = 0.16;
const UMBRAL_MOVIMIENTO_BAJO = 0.07;
const TIEMPO_MOVIMIENTO_ALTO = 700;
const TIEMPO_CALMA = 900;
const INTERVALO_MOVIMIENTO = 220;
const CALIBRACION_MOVIMIENTO = 800;
const SEPARACION_EVENTOS_MS = 2500;

const COLUMNAS_FEEDBACK = [
    "Momento (Tiempo)",
    "Señal de Inseguridad Detectada",
    "Recomendación del Coach"
];

/* ============================= */
/* UTILIDADES */
/* ============================= */

function obtenerSituacion() {
    for (const opcion of situaciones) {
        if (opcion.checked) {
            return opcion.value;
        }
    }

    return "estudiante";
}

function obtenerCSRFToken() {
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
        const elemento = cookie.trim();

        if (elemento.startsWith("csrftoken=")) {
            return decodeURIComponent(
                elemento.substring("csrftoken=".length)
            );
        }
    }

    return "";
}

function formatearTiempo(segundos) {
    const total = Math.max(0, Math.floor(Number(segundos) || 0));
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const resto = total % 60;

    const mm = String(minutos).padStart(2, "0");
    const ss = String(resto).padStart(2, "0");

    return horas > 0 ? horas + ":" + mm + ":" + ss : mm + ":" + ss;
}

function parsearTiempo(valor) {
    if (typeof valor === "number" && isFinite(valor)) {
        return Math.max(0, Math.floor(valor));
    }

    const texto = String(valor || "").trim();

    if (!texto) {
        return null;
    }

    let coincidencia = texto.match(/(\d{1,2}):(\d{2}):(\d{2})/);

    if (coincidencia) {
        return (
            parseInt(coincidencia[1], 10) * 3600 +
            parseInt(coincidencia[2], 10) * 60 +
            parseInt(coincidencia[3], 10)
        );
    }

    coincidencia = texto.match(/(\d{1,2}):(\d{2})/);

    if (coincidencia) {
        return (
            parseInt(coincidencia[1], 10) * 60 +
            parseInt(coincidencia[2], 10)
        );
    }

    coincidencia = texto.match(/^(\d{1,4})\s*(?:s|seg|segundos)?$/i);

    if (coincidencia) {
        return parseInt(coincidencia[1], 10);
    }

    return null;
}

function limpiarMarkdownFeedback(texto) {
    return String(texto || "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^#{1,6}\s*/, "")
        .replace(/\s*\|\s*/g, " · ")
        .trim();
}

/* ============================= */
/* MODAL DE FEEDBACK */
/* ============================= */

function abrirModalFeedback(mensaje) {
    contenidoFeedback.innerHTML = "";

    const cargando = document.createElement("p");
    cargando.className = "feedback-cargando";
    cargando.textContent = mensaje;

    contenidoFeedback.appendChild(cargando);

    modalFeedback.style.display = "flex";
}

function cerrarModalFeedback() {
    modalFeedback.style.display = "none";

    if (videoResultado) {
        videoResultado.pause();
    }
}

cerrarFeedback.onclick = cerrarModalFeedback;

/* ============================= */
/* VIDEO DE RESULTADO */
/* ============================= */

function limpiarVideoResultado() {
    if (urlVideoActual) {
        URL.revokeObjectURL(urlVideoActual);
        urlVideoActual = null;
    }

    videoResultado.pause();
    videoResultado.removeAttribute("src");
    videoResultado.load();

    descargarVideo.removeAttribute("href");
    reproductorResultado.hidden = true;
}

function mostrarVideoResultado(blob) {
    if (urlVideoActual) {
        URL.revokeObjectURL(urlVideoActual);
    }

    urlVideoActual = URL.createObjectURL(blob);

    videoResultado.src = urlVideoActual;
    videoResultado.load();

    descargarVideo.href = urlVideoActual;
    descargarVideo.download = "practica-speakup.webm";

    reproductorResultado.hidden = false;
}

/* ============================= */
/* MÉTRICAS EN VIVO */
/* ============================= */

function actualizarReloj() {
    if (!fechaInicio) {
        tiempoPracticaEl.textContent = "00:00";
        return;
    }

    const segundos = Math.max(
        0,
        Math.floor((Date.now() - fechaInicio.getTime()) / 1000)
    );

    tiempoPracticaEl.textContent = formatearTiempo(segundos);
}

function iniciarReloj() {
    detenerReloj();
    actualizarReloj();

    intervaloReloj = setInterval(actualizarReloj, 500);
}

function detenerReloj() {
    if (intervaloReloj !== null) {
        clearInterval(intervaloReloj);
        intervaloReloj = null;
    }
}

function actualizarMetricas() {
    alertasPracticaEl.textContent = String(eventosCorporales.length);
}

/* ============================= */
/* TRANSCRIPCIÓN EN VIVO */
/* ============================= */

function reconocimientoVozDisponible() {
    return Boolean(
        window.SpeechRecognition ||
        window.webkitSpeechRecognition
    );
}

function actualizarEstadoTranscripcion(texto, escuchando) {
    transcripcionEstado.textContent = texto;

    transcripcionEstado.classList.toggle(
        "escuchando",
        Boolean(escuchando)
    );
}

function obtenerTextoTranscrito() {
    return (transcripcionFinal + " " + transcripcionInterina)
        .replace(/\s+/g, " ")
        .trim();
}

function renderizarTranscripcion() {
    transcripcionTexto.innerHTML = "";

    const final = transcripcionFinal.trim();
    const interino = transcripcionInterina.trim();

    if (!final && !interino) {
        const vacio = document.createElement("span");
        vacio.className = "transcripcion-vacia";
        vacio.textContent = mensajeTranscripcionVacio;

        transcripcionTexto.appendChild(vacio);
        return;
    }

    if (final) {
        transcripcionTexto.appendChild(
            document.createTextNode(final + " ")
        );
    }

    if (interino) {
        const span = document.createElement("span");
        span.className = "transcripcion-interina";
        span.textContent = interino;

        transcripcionTexto.appendChild(span);
    }

    if (transcripcionActiva) {
        const cursor = document.createElement("span");
        cursor.className = "transcripcion-cursor";
        cursor.textContent = "|";

        transcripcionTexto.appendChild(cursor);
    }

    transcripcionTexto.scrollTop = transcripcionTexto.scrollHeight;
}

function manejarResultadoVoz(evento) {
    let interino = "";

    for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];

        if (!resultado || !resultado[0]) {
            continue;
        }

        const texto = String(resultado[0].transcript || "")
            .replace(/\s+/g, " ")
            .trim();

        if (!texto) {
            continue;
        }

        if (resultado.isFinal) {
            transcripcionFinal =
                (transcripcionFinal + " " + texto).trim();
        } else {
            interino = (interino + " " + texto).trim();
        }
    }

    transcripcionInterina = interino;

    actualizarEstadoTranscripcion("Escuchando", true);
    renderizarTranscripcion();
}

function manejarErrorVoz(evento) {
    const error = evento.error || "";

    if (error === "no-speech" || error === "aborted") {
        return;
    }

    if (error === "not-allowed" || error === "service-not-allowed") {
        transcripcionActiva = false;
        mensajeTranscripcionVacio =
            "Permite el acceso al micrófono para ver la transcripción en vivo.";
        actualizarEstadoTranscripcion("Micrófono bloqueado", false);
        renderizarTranscripcion();
        return;
    }

    if (error === "audio-capture") {
        transcripcionActiva = false;
        mensajeTranscripcionVacio =
            "No se encontró un micrófono disponible.";
        actualizarEstadoTranscripcion("Sin micrófono", false);
        renderizarTranscripcion();
        return;
    }

    if (error === "network") {
        transcripcionActiva = false;
        mensajeTranscripcionVacio =
            "La transcripción en vivo perdió la conexión.";
        actualizarEstadoTranscripcion("Sin conexión", false);
        renderizarTranscripcion();
        return;
    }

    actualizarEstadoTranscripcion("Error de voz", false);
}

function construirReconocimientoVoz() {
    if (reconocimientoVoz) {
        return reconocimientoVoz;
    }

    const Constructor =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Constructor) {
        return null;
    }

    const reconocimiento = new Constructor();

    reconocimiento.lang = "es-ES";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;
    reconocimiento.maxAlternatives = 1;

    reconocimiento.onstart = function () {
        if (!transcripcionActiva) {
            return;
        }

        actualizarEstadoTranscripcion("Escuchando", true);
    };

    reconocimiento.onresult = manejarResultadoVoz;
    reconocimiento.onerror = manejarErrorVoz;

    reconocimiento.onend = function () {
        if (reconocimientoVoz !== reconocimiento) {
            return;
        }

        if (transcripcionActiva && practicando) {
            if (temporizadorReinicioVoz) {
                clearTimeout(temporizadorReinicioVoz);
            }

            temporizadorReinicioVoz = setTimeout(function () {
                temporizadorReinicioVoz = null;

                if (!transcripcionActiva || !practicando) {
                    return;
                }

                try {
                    reconocimiento.start();
                } catch (error) {
                    // El reconocimiento ya estaba iniciado.
                }
            }, 200);

            return;
        }

        actualizarEstadoTranscripcion("Finalizada", false);
        renderizarTranscripcion();
    };

    reconocimientoVoz = reconocimiento;

    return reconocimiento;
}

function iniciarTranscripcionVoz() {
    transcripcionFinal = "";
    transcripcionInterina = "";
    mensajeTranscripcionVacio =
        "Aquí verás tus palabras mientras presentas.";

    renderizarTranscripcion();

    if (!reconocimientoVozDisponible()) {
        transcripcionActiva = false;
        mensajeTranscripcionVacio =
            "Tu navegador no permite la transcripción en vivo.";
        actualizarEstadoTranscripcion("No disponible", false);
        renderizarTranscripcion();
        return;
    }

    const reconocimiento = construirReconocimientoVoz();

    if (!reconocimiento) {
        return;
    }

    transcripcionActiva = true;
    actualizarEstadoTranscripcion("Conectando", false);

    try {
        reconocimiento.start();
    } catch (error) {
        // Si el reconocimiento anterior aún se está cerrando,
        // reintentamos en cuanto termine.
        setTimeout(function () {
            if (!transcripcionActiva || !practicando) {
                return;
            }

            try {
                reconocimiento.start();
            } catch (errorReintento) {
                // El reconocimiento ya estaba iniciado.
            }
        }, 300);
    }
}

function detenerTranscripcionVoz() {
    transcripcionActiva = false;

    if (temporizadorReinicioVoz) {
        clearTimeout(temporizadorReinicioVoz);
        temporizadorReinicioVoz = null;
    }

    if (reconocimientoVoz) {
        try {
            reconocimientoVoz.stop();
        } catch (error) {
            // El reconocimiento ya estaba detenido.
        }
    }

    actualizarEstadoTranscripcion("Finalizada", false);
    renderizarTranscripcion();
}

/* ============================= */
/* CÁMARA Y GRABACIÓN DE VIDEO */
/* ============================= */

function obtenerMimeVideo() {
    const candidatos = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm"
    ];

    if (typeof MediaRecorder === "undefined" ||
        typeof MediaRecorder.isTypeSupported !== "function") {
        return "";
    }

    for (const candidato of candidatos) {
        if (MediaRecorder.isTypeSupported(candidato)) {
            return candidato;
        }
    }

    return "";
}

function iniciarGrabadoraVideo(flujo) {
    fragmentosVideo = [];

    const mime = obtenerMimeVideo();

    try {
        grabadoraVideo = mime
            ? new MediaRecorder(flujo, { mimeType: mime })
            : new MediaRecorder(flujo);
    } catch (error) {
        grabadoraVideo = new MediaRecorder(flujo);
    }

    grabadoraVideo.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) {
            fragmentosVideo.push(event.data);
        }
    };

    grabadoraVideo.start(1000);
}

function detenerGrabadoraVideo() {
    return new Promise(function (resolve) {
        const grabadora = grabadoraVideo;

        if (!grabadora || grabadora.state === "inactive") {
            grabadoraVideo = null;
            resolve(null);
            return;
        }

        grabadora.onstop = function () {
            const tipo = grabadora.mimeType || "video/webm";

            const blob = fragmentosVideo.length
                ? new Blob(fragmentosVideo, { type: tipo })
                : null;

            fragmentosVideo = [];
            grabadoraVideo = null;

            resolve(blob && blob.size > 0 ? blob : null);
        };

        try {
            grabadora.stop();
        } catch (error) {
            grabadoraVideo = null;
            resolve(null);
        }
    });
}

function detenerCamara() {
    detenerDeteccionMovimiento();

    if (flujoCamara) {
        flujoCamara.getTracks().forEach(function (pista) {
            pista.stop();
        });

        flujoCamara = null;
    }

    videoCamara.srcObject = null;

    moduloCamara.classList.remove("activa");
    camaraEstado.textContent = "Cámara inactiva";
    placeholderCamara.textContent =
        "La cámara se activará al comenzar la práctica";
}

/* ============================= */
/* DETECCIÓN DE MOVIMIENTO */
/* ============================= */

function iniciarDeteccionMovimiento() {
    detenerDeteccionMovimiento();

    cuadroAnterior = null;
    puntajeMovimiento = 0;
    inicioMovimientoAlto = null;
    inicioCalma = null;
    inicioDeteccion = Date.now();

    intervaloMovimiento = setInterval(
        analizarMovimiento,
        INTERVALO_MOVIMIENTO
    );
}

function detenerDeteccionMovimiento() {
    if (intervaloMovimiento !== null) {
        clearInterval(intervaloMovimiento);
        intervaloMovimiento = null;
    }

    cuadroAnterior = null;
    inicioMovimientoAlto = null;
    inicioCalma = null;

    ocultarAlertaMovimiento();
}

function analizarMovimiento() {
    if (document.hidden) {
        return;
    }

    if (!videoCamara.srcObject ||
        videoCamara.readyState < 2 ||
        !videoCamara.videoWidth) {
        return;
    }

    const ancho = canvasMovimiento.width;
    const alto = canvasMovimiento.height;

    contextoMovimiento.drawImage(videoCamara, 0, 0, ancho, alto);

    const datos = contextoMovimiento.getImageData(
        0,
        0,
        ancho,
        alto
    ).data;

    const cuadroActual = new Uint8ClampedArray(ancho * alto);

    for (let i = 0, j = 0; i < datos.length; i += 4, j++) {
        cuadroActual[j] =
            (datos[i] * 0.299) +
            (datos[i + 1] * 0.587) +
            (datos[i + 2] * 0.114);
    }

    if (!cuadroAnterior) {
        cuadroAnterior = cuadroActual;
        return;
    }

    let pixelesCambiados = 0;

    for (let i = 0; i < cuadroActual.length; i++) {
        if (Math.abs(cuadroActual[i] - cuadroAnterior[i]) > 28) {
            pixelesCambiados++;
        }
    }

    const proporcionCambio = pixelesCambiados / cuadroActual.length;

    cuadroAnterior = cuadroActual;

    puntajeMovimiento =
        (puntajeMovimiento * 0.65) +
        (proporcionCambio * 0.35);

    evaluarMovimiento(puntajeMovimiento);
}

function evaluarMovimiento(puntaje) {
    const ahora = Date.now();

    if (ahora - inicioDeteccion < CALIBRACION_MOVIMIENTO) {
        return;
    }

    if (puntaje >= UMBRAL_MOVIMIENTO_ALTO) {
        inicioCalma = null;

        if (inicioMovimientoAlto === null) {
            inicioMovimientoAlto = ahora;
        }

        if (!alertaMovimientoVisible &&
            ahora - inicioMovimientoAlto >= TIEMPO_MOVIMIENTO_ALTO) {
            mostrarAlertaMovimiento();
        }
    } else if (puntaje <= UMBRAL_MOVIMIENTO_BAJO) {
        inicioMovimientoAlto = null;

        if (inicioCalma === null) {
            inicioCalma = ahora;
        }

        if (alertaMovimientoVisible &&
            ahora - inicioCalma >= TIEMPO_CALMA) {
            ocultarAlertaMovimiento();
        }
    }
}

function mostrarAlertaMovimiento() {
    alertaMovimientoVisible = true;

    alertaMovimiento.classList.add("visible");
    moduloCamara.classList.add("movimiento-alto");

    if (!practicando || !fechaInicio) {
        return;
    }

    const ahora = Date.now();

    if (ahora - ultimoEventoMs < SEPARACION_EVENTOS_MS) {
        return;
    }

    ultimoEventoMs = ahora;

    const segundo = Math.max(
        0,
        Math.floor((ahora - fechaInicio.getTime()) / 1000)
    );

    eventosCorporales.push({
        segundo: segundo,
        senal: "Movimiento excesivo detectado",
        intensidad: Math.round(puntajeMovimiento * 100)
    });

    actualizarMetricas();

    resumenVivo.textContent =
        "Movimiento excesivo detectado en " +
        formatearTiempo(segundo) +
        ". Alertas visuales: " + eventosCorporales.length + ".";
}

function ocultarAlertaMovimiento() {
    alertaMovimientoVisible = false;

    alertaMovimiento.classList.remove("visible");
    moduloCamara.classList.remove("movimiento-alto");
}

/* ============================= */
/* BOTÓN DINÁMICO */
/* ============================= */

botonAccion.onclick = async function () {
    if (finalizando || guardando || camaraIniciando) {
        return;
    }

    if (practicando) {
        await terminarPractica();
    } else {
        await comenzarPractica();
    }
};

function restablecerBoton() {
    document.body.classList.remove("grabando");

    camaraIniciando = false;
    botonAccion.disabled = false;
    botonAccion.textContent = "Comenzar práctica";

    resumenVivo.textContent =
        "La grabación de video no incluye audio; la transcripción se genera en vivo.";
}

/* ============================= */
/* COMENZAR PRÁCTICA */
/* ============================= */

async function comenzarPractica() {
    if (practicando || camaraIniciando) {
        return;
    }

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
        estado.textContent =
            "Este navegador no permite acceder a la cámara.";
        return;
    }

    if (typeof MediaRecorder === "undefined") {
        estado.textContent =
            "Este navegador no permite grabar video.";
        return;
    }

    camaraIniciando = true;
    finalizando = false;
    guardando = false;

    limpiarVideoResultado();
    detenerCamara();
    detenerReloj();

    eventosCorporales = [];
    ultimoEventoMs = 0;
    fechaInicio = null;
    fechaFin = null;

    actualizarMetricas();
    tiempoPracticaEl.textContent = "00:00";
    alertasPracticaEl.textContent = "0";
    resumenVivo.textContent =
        "Analizando tu lenguaje corporal en tiempo real.";

    botonAccion.disabled = true;
    estado.textContent = "Solicitando acceso a la cámara...";

    try {
        const flujo = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        // Garantía adicional: el stream no debe llevar audio.
        flujo.getAudioTracks().forEach(function (pista) {
            flujo.removeTrack(pista);
            pista.stop();
        });

        flujoCamara = flujo;

        videoCamara.srcObject = flujoCamara;
        await videoCamara.play();

        moduloCamara.classList.add("activa");
        camaraEstado.textContent =
            "Cámara activa · grabando video sin audio";

        placeholderCamara.textContent =
            "Grabando tu lenguaje corporal...";

        fechaInicio = new Date();
        practicando = true;

        iniciarGrabadoraVideo(flujoCamara);
        iniciarDeteccionMovimiento();
        iniciarReloj();
        iniciarTranscripcionVoz();

        document.body.classList.add("grabando");

        botonAccion.disabled = false;
        botonAccion.textContent = "Terminar práctica";

        estado.textContent = "Grabando video sin audio...";
    } catch (error) {
        console.error("Error de cámara:", error);

        practicando = false;
        camaraIniciando = false;

        detenerCamara();
        restablecerBoton();

        if (error.name === "NotAllowedError" ||
            error.name === "SecurityError") {
            camaraEstado.textContent =
                "Cámara bloqueada. Permite el acceso para analizar tu lenguaje corporal.";
            estado.textContent =
                "Permite el acceso a la cámara para comenzar la práctica.";
        } else if (error.name === "NotFoundError") {
            camaraEstado.textContent =
                "No se encontró una cámara disponible.";
            estado.textContent =
                "Conecta una cámara y vuelve a intentarlo.";
        } else {
            camaraEstado.textContent =
                "No se pudo iniciar la cámara.";
            estado.textContent =
                "No se pudo iniciar la cámara. Vuelve a intentarlo.";
        }
    } finally {
        camaraIniciando = false;
    }
}

/* ============================= */
/* TERMINAR PRÁCTICA */
/* ============================= */

async function terminarPractica() {
    if (!practicando || finalizando) {
        return;
    }

    finalizando = true;
    practicando = false;
    fechaFin = new Date();

    detenerReloj();
    detenerDeteccionMovimiento();
    detenerTranscripcionVoz();

    document.body.classList.remove("grabando");

    botonAccion.disabled = true;
    botonAccion.textContent = "Terminar práctica";

    const duracion = fechaInicio
        ? Math.max(
            1,
            Math.round((fechaFin.getTime() - fechaInicio.getTime()) / 1000)
        )
        : 0;

    tiempoPracticaEl.textContent = formatearTiempo(duracion);

    estado.textContent = "Preparando tu video...";
    resumenVivo.textContent = "Procesando el análisis visual de tu práctica...";

    const blob = await detenerGrabadoraVideo();

    detenerCamara();

    if (blob) {
        mostrarVideoResultado(blob);
        estado.textContent = "Video listo. Analizando tu lenguaje corporal...";
    } else {
        limpiarVideoResultado();
        estado.textContent =
            "No se pudo generar el video de la práctica.";
    }

    abrirModalFeedback(
        blob
            ? "Analizando tu lenguaje corporal..."
            : "No se pudo generar el video. Analizando la práctica..."
    );

    const filas = await solicitarFeedbackCorporal(duracion);

    await guardarConversacionCorporal(duracion, filas);

    finalizando = false;

    restablecerBoton();
}

/* ============================= */
/* PARSEO DEL FEEDBACK */
/* ============================= */

function extraerJSON(texto) {
    const contenido = String(texto || "")
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();

    const inicio = contenido.search(/[\[{]/);

    if (inicio === -1) {
        return null;
    }

    const finObjeto = contenido.lastIndexOf("}");
    const finArreglo = contenido.lastIndexOf("]");
    const fin = Math.max(finObjeto, finArreglo);

    if (fin <= inicio) {
        return null;
    }

    try {
        return JSON.parse(contenido.slice(inicio, fin + 1));
    } catch (error) {
        return null;
    }
}

function primerValor(objeto, claves) {
    for (const clave of claves) {
        if (objeto[clave] !== undefined && objeto[clave] !== null) {
            return objeto[clave];
        }
    }

    return "";
}

function normalizarFilaCorporal(item) {
    if (!item || typeof item !== "object") {
        return null;
    }

    const momento = primerValor(item, [
        "momento", "tiempo", "time", "timestamp", "segundo", "moment"
    ]);

    const senal = primerValor(item, [
        "senal", "señal", "signal", "observacion", "observación",
        "segmento", "aspecto", "hallazgo"
    ]);

    const recomendacion = primerValor(item, [
        "recomendacion", "recomendación", "recommendation",
        "consejo", "correccion", "corrección", "texto", "feedback"
    ]);

    if (!String(senal).trim() && !String(recomendacion).trim()) {
        return null;
    }

    return {
        momento: String(momento || "General").trim() || "General",
        senal: limpiarMarkdownFeedback(senal) || "Observación general",
        recomendacion:
            limpiarMarkdownFeedback(recomendacion) || "Sin recomendación."
    };
}

function parsearFeedbackCorporal(texto) {
    const filas = [];
    const contenido = String(texto || "").trim();

    if (!contenido) {
        return filas;
    }

    const datos = extraerJSON(contenido);

    if (datos) {
        let lista = [];

        if (Array.isArray(datos)) {
            lista = datos;
        } else if (Array.isArray(datos.feedback)) {
            lista = datos.feedback;
        } else if (typeof datos === "object") {
            lista = [datos];
        }

        for (const item of lista) {
            const fila = normalizarFilaCorporal(item);

            if (fila) {
                filas.push(fila);
            }
        }

        if (filas.length) {
            return filas;
        }
    }

    const lineas = contenido.split(/\r?\n/);
    const lineasLibres = [];

    for (const lineaOriginal of lineas) {
        const linea = lineaOriginal.trim();

        if (!linea || linea.startsWith("```")) {
            continue;
        }

        if (linea.includes("|")) {
            if (/^\|?[\s:\-|]+\|?$/.test(linea)) {
                continue;
            }

            const partes = linea
                .split("|")
                .map(function (parte) { return parte.trim(); })
                .filter(Boolean);

            if (partes.length >= 2) {
                const esEncabezado =
                    /momento|tiempo/i.test(partes[0]) &&
                    /se[ñn]al|inseguridad/i.test(partes[1] || "");

                if (esEncabezado) {
                    continue;
                }

                if (partes.length >= 3) {
                    filas.push({
                        momento: partes[0] || "General",
                        senal: limpiarMarkdownFeedback(partes[1]),
                        recomendacion: limpiarMarkdownFeedback(
                            partes.slice(2).join(" ")
                        )
                    });
                } else {
                    filas.push({
                        momento: "General",
                        senal: limpiarMarkdownFeedback(partes[0]),
                        recomendacion: limpiarMarkdownFeedback(partes[1])
                    });
                }

                continue;
            }
        }

        const conTiempo = linea.match(
            /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]\s*(.+)$/
        );

        if (conTiempo) {
            filas.push({
                momento: conTiempo[1],
                senal: "Observación visual",
                recomendacion: limpiarMarkdownFeedback(conTiempo[2])
            });

            continue;
        }

        lineasLibres.push(limpiarMarkdownFeedback(linea));
    }

    for (const linea of lineasLibres) {
        if (!linea) {
            continue;
        }

        filas.push({
            momento: "General",
            senal: "Observación general",
            recomendacion: linea
        });
    }

    if (!filas.length) {
        filas.push({
            momento: "General",
            senal: "Observación general",
            recomendacion: limpiarMarkdownFeedback(contenido)
        });
    }

    return filas;
}

/* ============================= */
/* TABLA DE FEEDBACK */
/* ============================= */

function crearCeldaTiempo(momento) {
    const celda = document.createElement("td");
    const segundos = parsearTiempo(momento);

    if (segundos === null) {
        celda.textContent = momento || "General";
        return celda;
    }

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "tiempo-enlace";
    boton.textContent = formatearTiempo(segundos);
    boton.title = "Ir a este momento del video";

    boton.onclick = function () {
        if (!videoResultado.src) {
            return;
        }

        try {
            videoResultado.currentTime = segundos;
            videoResultado.play();
            videoResultado.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        } catch (error) {
            console.error("No se pudo saltar al momento:", error);
        }
    };

    celda.appendChild(boton);

    return celda;
}

function crearTablaFeedbackCorporal(filas) {
    const tabla = document.createElement("table");
    tabla.className = "tabla-feedback tabla-corporal";

    const thead = document.createElement("thead");
    const filaEncabezado = document.createElement("tr");

    for (const columna of COLUMNAS_FEEDBACK) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = columna;
        filaEncabezado.appendChild(th);
    }

    thead.appendChild(filaEncabezado);

    const tbody = document.createElement("tbody");

    for (const fila of filas) {
        const tr = document.createElement("tr");
        const tdSenal = document.createElement("td");
        const tdRecomendacion = document.createElement("td");

        tdSenal.textContent = fila.senal || "Observación general";
        tdRecomendacion.textContent =
            fila.recomendacion || "Sin recomendación.";

        tr.appendChild(crearCeldaTiempo(fila.momento));
        tr.appendChild(tdSenal);
        tr.appendChild(tdRecomendacion);

        tbody.appendChild(tr);
    }

    tabla.appendChild(thead);
    tabla.appendChild(tbody);

    const contenedor = document.createElement("div");
    contenedor.className = "tabla-contenedor";
    contenedor.appendChild(tabla);

    return contenedor;
}

/* ============================= */
/* FEEDBACK DEL COACH */
/* ============================= */

function construirPromptCorporal(duracion, tipo) {
    const tipoTexto = tipo === "trabajador" ? "Trabajador" : "Estudiante";

    const eventos = eventosCorporales.length
        ? eventosCorporales.map(function (evento) {
            return (
                "- " + formatearTiempo(evento.segundo) +
                ": " + evento.senal +
                " (intensidad " + evento.intensidad + "%)"
            );
        }).join("\n")
        : "- No se detectaron picos fuertes de movimiento; la postura fue estable.";

    return [
        "Tipo de presentación: " + tipoTexto + ".",
        "Duración de la práctica: " + formatearTiempo(duracion) +
            " (" + duracion + " segundos).",
        "La grabación es solo de video, sin audio. Analiza exclusivamente",
        "el lenguaje corporal y las señales visuales de inseguridad.",
        "Eventos visuales detectados automáticamente:",
        eventos,
        "Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta:",
        '{"feedback":[{"momento":"mm:ss",' +
            '"senal":"Señal de inseguridad detectada",' +
            '"recomendacion":"Recomendación accionable del coach"}]}.',
        "Incluye entre 3 y 6 filas. Usa los momentos detectados y agrega",
        "otros momentos relevantes dentro de la duración. No uses Markdown,",
        "tablas, viñetas ni texto adicional fuera del JSON."
    ].join(" ");
}

async function solicitarFeedbackCorporal(duracion) {
    const tipo = obtenerSituacion();
    const prompt = construirPromptCorporal(duracion, tipo);

    try {
        const respuesta = await fetch("/api/ask-presentacion/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": obtenerCSRFToken()
            },
            credentials: "same-origin",
            body: JSON.stringify({ prompt: prompt })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error || "No se pudo obtener el feedback."
            );
        }

        const filas = parsearFeedbackCorporal(datos.response || "");

        if (!filas.length) {
            throw new Error(
                "No se recibió feedback para esta práctica."
            );
        }

        contenidoFeedback.innerHTML = "";
        contenidoFeedback.appendChild(
            crearTablaFeedbackCorporal(filas)
        );

        return filas;
    } catch (error) {
        const filas = [{
            momento: "General",
            senal: "Análisis no disponible",
            recomendacion: error.message
        }];

        contenidoFeedback.innerHTML = "";
        contenidoFeedback.appendChild(
            crearTablaFeedbackCorporal(filas)
        );

        return filas;
    }
}

/* ============================= */
/* GUARDAR PRÁCTICA EN DJANGO */
/* ============================= */

function construirResumen(duracion) {
    const tipo = obtenerSituacion();
    const tipoTexto = tipo === "trabajador" ? "Trabajador" : "Estudiante";

    const partes = [
        "Práctica de lenguaje corporal (" + tipoTexto + ").",
        "Duración: " + formatearTiempo(duracion) + ".",
        "Eventos visuales detectados: " + eventosCorporales.length + "."
    ];

    const textoTranscrito = obtenerTextoTranscrito();

    if (textoTranscrito) {
        partes.push("Transcripción: " + textoTranscrito);
    }

    if (eventosCorporales.length) {
        partes.push(
            "Momentos: " +
            eventosCorporales.map(function (evento) {
                return formatearTiempo(evento.segundo);
            }).join(", ") + "."
        );
    }

    return partes.join(" ");
}

function consejoPorTipo(tipo) {
    if (tipo === "trabajador") {
        return (
            "Mantén una postura abierta y estable, con gestos controlados " +
            "que acompañen tu mensaje. Evita movimientos repetitivos y " +
            "dirige la mirada a la cámara como si fuera tu audiencia."
        );
    }

    return (
        "Apoya firmemente los pies, mantén los hombros relajados y evita " +
        "balancearte. Usa las manos para acompañar tus ideas y sostén el " +
        "contacto visual con la cámara."
    );
}

async function guardarConversacionCorporal(duracion, filas) {
    if (guardando) {
        return;
    }

    guardando = true;

    const tipo = obtenerSituacion();

    try {
        const respuesta = await fetch("/guardar-conversacion-presentacion/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": obtenerCSRFToken()
            },
            credentials: "same-origin",
            body: JSON.stringify({
                transcripcion: construirResumen(duracion),
                situacion: tipo,
                palabras_relleno: 0,
                palabras_repetidas: {},
                recomendacion: filas.map(function (fila) {
                    return fila.momento + " · " + fila.senal +
                        ": " + fila.recomendacion;
                }).join("\n"),
                consejo_situacion: consejoPorTipo(tipo),
                fecha_inicio: fechaInicio
                    ? fechaInicio.toISOString()
                    : new Date().toISOString()
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error || "No se pudo guardar la práctica."
            );
        }

        estado.textContent =
            "Práctica guardada correctamente en Mi progreso.";
    } catch (error) {
        console.error("Error al guardar la práctica:", error);
        estado.textContent =
            "No se pudo guardar la práctica en Mi progreso.";
    } finally {
        guardando = false;
    }
}
