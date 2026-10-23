
"use strict";

// ========================================
// SPEAKUP3 - SISTEMA COMPLETO
// ========================================

console.log("SpeakUP3: sistema actualizado");

// ELEMENTOS DE LA PÁGINA
const boton = document.getElementById("iniciar");
const detener = document.getElementById("detener");
const estado = document.getElementById("estado");
const texto = document.getElementById("texto");
const situaciones = document.getElementsByName("situacion");

const cantidadPalabras = document.getElementById("cantidadPalabras");
const relleno = document.getElementById("relleno");
const repetidas = document.getElementById("repetidas");
const recomendacion = document.getElementById("recomendacion");
const consejoSituacion = document.getElementById("consejoSituacion");

// ELEMENTOS DEL MODAL
const ventanaResultados = document.getElementById("ventanaResultados");
const cerrarResultados = document.getElementById("cerrarResultados");
const volverPractica = document.getElementById("volverPractica");
const mensajeGuardado = document.getElementById("mensajeGuardado");

const modalPalabras = document.getElementById("modalPalabras");
const modalMuletillas = document.getElementById("modalMuletillas");
const modalRepetidas = document.getElementById("modalRepetidas");
const modalRecomendacion = document.getElementById("modalRecomendacion");
const modalConsejo = document.getElementById("modalConsejo");
const modalMejora = document.getElementById("modalMejora");
const mensajeVideoResultados = document.getElementById(
    "mensajeVideoResultados"
);

// ELEMENTOS DE CÁMARA
const videoCamara = document.getElementById("videoCamara");
const camaraApagada = document.getElementById("camaraApagada");
const activarCamara = document.getElementById("activarCamara");
const desactivarCamara = document.getElementById("desactivarCamara");
const estadoCamara = document.getElementById("estadoCamara");

// ELEMENTOS DE GRABACIÓN
const iniciarGrabacion = document.getElementById("iniciarGrabacion");
const detenerGrabacion = document.getElementById("detenerGrabacion");
const estadoGrabacion = document.getElementById("estadoGrabacion");
const indicadorGrabacion = document.getElementById("indicadorGrabacion");
const seccionVideoGrabado = document.getElementById("seccionVideoGrabado");
const videoGrabado = document.getElementById("videoGrabado");
const descargarVideo = document.getElementById("descargarVideo");
const descartarVideo = document.getElementById("descartarVideo");

// VARIABLES DE CÁMARA
let flujoCamara = null;
let solicitandoCamara = false;
let solicitudCamara = 0;

// VARIABLES DE VIDEO
let grabadorVideo = null;
let fragmentosVideo = [];
let urlVideoGrabado = null;
let grabandoVideo = false;
let finalizandoVideo = false;
let apagarCamaraAlFinalizar = false;
let resultadosPendientes = null;

// VARIABLES DE VOZ
let textoGuardado = "";
let escuchando = false;
let guardarAlTerminar = false;
let guardando = false;
let fechaInicio = null;
let sesionReconocimiento = 0;

// ========================================
// FUNCIONES GENERALES
// ========================================

function obtenerSituacion() {
    for (const opcion of situaciones) {
        if (opcion.checked) return opcion.value;
    }
    return "presentacion";
}

function cambiarEstadoGrabacion(mensaje) {
    if (estadoGrabacion) {
        estadoGrabacion.textContent = mensaje;
    }
}

function camaraEstaActiva() {
    return Boolean(
        flujoCamara &&
        flujoCamara.getVideoTracks().some(
            pista => pista.readyState === "live"
        )
    );
}

function actualizarBotonesGrabacion() {
    const activa = camaraEstaActiva();

    if (activarCamara) {
        activarCamara.disabled = activa || solicitandoCamara;
    }

    if (desactivarCamara) {
        desactivarCamara.disabled =
            (!activa && !solicitandoCamara) ||
            finalizandoVideo;
    }

    if (iniciarGrabacion) {
        iniciarGrabacion.disabled =
            !activa ||
            typeof MediaRecorder === "undefined" ||
            grabandoVideo ||
            finalizandoVideo;
    }

    if (detenerGrabacion) {
        detenerGrabacion.disabled = !grabandoVideo;
    }

    if (indicadorGrabacion) {
        indicadorGrabacion.hidden = !grabandoVideo;
    }
}

function actualizarInterfazCamara(activa, mensaje) {
    if (videoCamara) {
        videoCamara.hidden = !activa;
    }

    if (camaraApagada) {
        camaraApagada.hidden = activa;
    }

    if (estadoCamara) {
        estadoCamara.textContent = mensaje;
    }

    actualizarBotonesGrabacion();
}

// ========================================
// LIMPIAR VIDEO ANTERIOR
// ========================================

function limpiarVideoGrabado() {
    if (videoGrabado) {
        videoGrabado.pause();
        videoGrabado.removeAttribute("src");
        videoGrabado.load();
    }

    if (urlVideoGrabado) {
        URL.revokeObjectURL(urlVideoGrabado);
        urlVideoGrabado = null;
    }

    if (descargarVideo) {
        descargarVideo.removeAttribute("href");
        descargarVideo.removeAttribute("download");
    }

    if (seccionVideoGrabado) {
        seccionVideoGrabado.hidden = true;
    }

    if (mensajeVideoResultados) {
        mensajeVideoResultados.hidden = false;
        mensajeVideoResultados.textContent =
            "No hay video disponible para esta práctica.";
    }
}

// ========================================
// FORMATOS DE GRABACIÓN
// ========================================

function obtenerFormatoGrabacion() {
    if (typeof MediaRecorder === "undefined") {
        return null;
    }

    const formatos = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4"
    ];

    for (const formato of formatos) {
        if (MediaRecorder.isTypeSupported(formato)) {
            return formato;
        }
    }

    return "";
}

// ========================================
// ENCENDER CÁMARA Y GRABAR AUTOMÁTICAMENTE
// ========================================

async function encenderCamara() {
    if (flujoCamara || solicitandoCamara) return;

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        actualizarInterfazCamara(
            false,
            "La cámara requiere localhost o HTTPS."
        );
        return;
    }

    solicitandoCamara = true;
    const solicitudActual = ++solicitudCamara;

    actualizarInterfazCamara(
        false,
        "Esperando permiso para usar la cámara..."
    );

    let flujo = null;

    try {
        flujo = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 360 },
                frameRate: { ideal: 24, max: 30 }
            },
            audio: false
        });

        if (solicitudActual !== solicitudCamara) {
            flujo.getTracks().forEach(pista => pista.stop());
            return;
        }

        flujoCamara = flujo;
        videoCamara.srcObject = flujo;
        videoCamara.muted = true;

        for (const pista of flujo.getVideoTracks()) {
            pista.addEventListener("ended", () => {
                if (flujoCamara !== flujo) return;

                if (grabandoVideo) {
                    apagarCamaraAlFinalizar = true;
                    detenerGrabacionVideo();
                } else if (!finalizandoVideo) {
                    apagarCamara();
                }
            });
        }

        await videoCamara.play();

        if (solicitudActual !== solicitudCamara) return;

        solicitandoCamara = false;

        actualizarInterfazCamara(
            true,
            "Cámara activada. Iniciando grabación..."
        );

        // La grabación empieza automáticamente después
        // de que el usuario activa la cámara.
        comenzarGrabacionVideo();

    } catch (error) {
        console.error("Error de cámara:", error);

        if (solicitudActual !== solicitudCamara) return;

        solicitandoCamara = false;

        if (flujo) {
            flujo.getTracks().forEach(pista => pista.stop());
        }

        flujoCamara = null;

        if (videoCamara) {
            videoCamara.srcObject = null;
        }

        let mensaje = "No se pudo activar la cámara.";

        if (error.name === "NotAllowedError") {
            mensaje = "Permiso de cámara rechazado.";
        } else if (error.name === "NotFoundError") {
            mensaje = "No se encontró una cámara.";
        } else if (error.name === "NotReadableError") {
            mensaje = "La cámara está ocupada.";
        }

        actualizarInterfazCamara(false, mensaje);
    }
}

// ========================================
// APAGAR CÁMARA
// ========================================

function apagarCamara() {
    if (grabandoVideo) {
        apagarCamaraAlFinalizar = true;
        detenerGrabacionVideo();
        return;
    }

    if (finalizandoVideo) {
        apagarCamaraAlFinalizar = true;
        return;
    }

    solicitudCamara++;
    solicitandoCamara = false;
    apagarCamaraAlFinalizar = false;

    if (flujoCamara) {
        const flujo = flujoCamara;
        flujoCamara = null;

        flujo.getTracks().forEach(pista => pista.stop());
    }

    if (videoCamara) {
        videoCamara.pause();
        videoCamara.srcObject = null;
    }

    actualizarInterfazCamara(
        false,
        "Cámara desactivada."
    );

    cambiarEstadoGrabacion(
        "Activa la cámara para iniciar otra grabación."
    );
}

// ========================================
// INICIAR GRABACIÓN DE VIDEO
// ========================================

function comenzarGrabacionVideo() {
    if (
        !camaraEstaActiva() ||
        grabandoVideo ||
        finalizandoVideo
    ) {
        return;
    }

    const formato = obtenerFormatoGrabacion();

    if (formato === null) {
        cambiarEstadoGrabacion(
            "Este navegador no permite grabar video."
        );
        return;
    }

    try {
        const pistas = flujoCamara.getVideoTracks().filter(
            pista => pista.readyState === "live"
        );

        // IMPORTANTE: solo video, sin audio.
        const flujoSoloVideo = new MediaStream(pistas);

        const opciones = formato
            ? { mimeType: formato }
            : {};

        const nuevoGrabador = new MediaRecorder(
            flujoSoloVideo,
            opciones
        );

        limpiarVideoGrabado();

        fragmentosVideo = [];
        grabadorVideo = nuevoGrabador;

        nuevoGrabador.ondataavailable = function (event) {
            if (event.data && event.data.size > 0) {
                fragmentosVideo.push(event.data);
            }
        };

        nuevoGrabador.onerror = function (event) {
            console.error("Error de grabación:", event);
            cambiarEstadoGrabacion(
                "Ocurrió un error durante la grabación."
            );
        };

        nuevoGrabador.onstop = function () {
            const tipoVideo =
                nuevoGrabador.mimeType ||
                formato ||
                "video/webm";

            grabandoVideo = false;
            finalizandoVideo = false;

            const archivoVideo = new Blob(
                fragmentosVideo,
                { type: tipoVideo }
            );

            fragmentosVideo = [];
            grabadorVideo = null;

            if (archivoVideo.size > 0) {
                urlVideoGrabado = URL.createObjectURL(
                    archivoVideo
                );

                if (videoGrabado) {
                    videoGrabado.src = urlVideoGrabado;
                    videoGrabado.load();
                }

                const extension = tipoVideo.includes("mp4")
                    ? "mp4"
                    : "webm";

                const fecha = new Date();

                const marcaFecha = [
                    fecha.getFullYear(),
                    String(fecha.getMonth() + 1).padStart(2, "0"),
                    String(fecha.getDate()).padStart(2, "0")
                ].join("-");

                const marcaHora = [
                    String(fecha.getHours()).padStart(2, "0"),
                    String(fecha.getMinutes()).padStart(2, "0")
                ].join("-");

                if (descargarVideo) {
                    descargarVideo.href = urlVideoGrabado;
                    descargarVideo.download =
                        `SpeakUP3_${marcaFecha}_${marcaHora}.${extension}`;
                }

                if (seccionVideoGrabado) {
                    seccionVideoGrabado.hidden = false;
                }

                if (mensajeVideoResultados) {
                    mensajeVideoResultados.hidden = true;
                }

                cambiarEstadoGrabacion(
                    "Grabación finalizada. Puedes verla en los resultados."
                );
            } else {
                cambiarEstadoGrabacion(
                    "No se pudo generar el video."
                );
            }

            if (apagarCamaraAlFinalizar) {
                apagarCamara();
            } else {
                actualizarBotonesGrabacion();
            }

            // Esperamos a que MediaRecorder genere el archivo
            // antes de abrir la ventana de resultados.
            if (resultadosPendientes) {
                const pendiente = resultadosPendientes;
                resultadosPendientes = null;

                mostrarVentanaResultados(
                    pendiente.resultados,
                    pendiente.guardado
                );
            }
        };

        nuevoGrabador.start(1000);

        grabandoVideo = true;
        finalizandoVideo = false;

        cambiarEstadoGrabacion(
            "🔴 Grabando video automáticamente..."
        );

        if (estadoCamara) {
            estadoCamara.textContent =
                "Cámara activada. Grabación en curso.";
        }

        actualizarBotonesGrabacion();

        console.log("Grabación iniciada.");

    } catch (error) {
        console.error("No se pudo iniciar grabación:", error);

        grabandoVideo = false;
        finalizandoVideo = false;
        grabadorVideo = null;
        fragmentosVideo = [];

        cambiarEstadoGrabacion(
            "No se pudo iniciar la grabación."
        );

        actualizarBotonesGrabacion();
    }
}

// ========================================
// DETENER GRABACIÓN
// ========================================

function detenerGrabacionVideo() {
    if (
        !grabadorVideo ||
        grabadorVideo.state === "inactive" ||
        finalizandoVideo
    ) {
        return;
    }

    grabandoVideo = false;
    finalizandoVideo = true;

    cambiarEstadoGrabacion(
        "Procesando video, espera un momento..."
    );

    actualizarBotonesGrabacion();

    try {
        grabadorVideo.stop();
    } catch (error) {
        console.error("Error al detener video:", error);

        finalizandoVideo = false;
        actualizarBotonesGrabacion();

        cambiarEstadoGrabacion(
            "No se pudo finalizar la grabación."
        );

        if (resultadosPendientes) {
            const pendiente = resultadosPendientes;
            resultadosPendientes = null;
            mostrarVentanaResultados(
                pendiente.resultados,
                pendiente.guardado
            );
        }
    }
}

// ========================================
// EVENTOS DE CÁMARA Y VIDEO
// ========================================

activarCamara?.addEventListener(
    "click",
    encenderCamara
);

desactivarCamara?.addEventListener(
    "click",
    apagarCamara
);

iniciarGrabacion?.addEventListener(
    "click",
    comenzarGrabacionVideo
);

detenerGrabacion?.addEventListener(
    "click",
    detenerGrabacionVideo
);

descartarVideo?.addEventListener("click", () => {
    limpiarVideoGrabado();
    cambiarEstadoGrabacion(
        "Video descartado."
    );
});

descargarVideo?.addEventListener("click", event => {
    if (!urlVideoGrabado) {
        event.preventDefault();
    }
});

// ========================================
// RECONOCIMIENTO DE VOZ
// ========================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let reconocimiento = null;

if (SpeechRecognition) {
    reconocimiento = new SpeechRecognition();
    reconocimiento.lang = "es-CL";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;
} else {
    if (estado) {
        estado.textContent =
            "Tu navegador no soporta reconocimiento de voz.";
    }
    if (boton) boton.disabled = true;
}

// ========================================
// INICIAR PRÁCTICA
// ========================================

boton?.addEventListener("click", function () {
    if (!reconocimiento || escuchando || guardando) {
        return;
    }

    textoGuardado = "";
    texto.value = "";
    fechaInicio = new Date();

    guardarAlTerminar = false;
    escuchando = true;
    sesionReconocimiento++;

    boton.disabled = true;
    detener.disabled = false;

    estado.textContent = "Escuchando...";

    try {
        reconocimiento.start();
    } catch (error) {
        console.error(error);

        escuchando = false;
        boton.disabled = false;
        detener.disabled = true;

        estado.textContent =
            "No se pudo iniciar el micrófono.";
    }
});

// ========================================
// DETENER PRÁCTICA
// ========================================

detener?.addEventListener("click", function () {
    if (!reconocimiento || !escuchando) return;

    escuchando = false;
    guardarAlTerminar = true;

    detener.disabled = true;

    estado.textContent =
        "Finalizando reconocimiento...";

    // Detenemos también el video.
    if (grabandoVideo) {
        detenerGrabacionVideo();
    }

    reconocimiento.stop();
});

// ========================================
// TRANSCRIPCIÓN
// ========================================

if (reconocimiento) {
    reconocimiento.onresult = function (event) {
        let temporal = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {
            const resultado =
                event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                textoGuardado += resultado + " ";
            } else {
                temporal += resultado;
            }
        }

        texto.value = textoGuardado + temporal;
    };

    reconocimiento.onerror = function (event) {
        console.error(
            "Error de reconocimiento:",
            event.error
        );

        estado.textContent =
            "Error del micrófono: " + event.error;

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {
            escuchando = false;
            guardarAlTerminar = false;

            boton.disabled = false;
            detener.disabled = true;

            if (grabandoVideo) {
                detenerGrabacionVideo();
            }
        }
    };

    reconocimiento.onend = async function () {
        if (escuchando) {
            try {
                reconocimiento.start();
            } catch (error) {
                console.error(
                    "No se pudo reanudar:",
                    error
                );

                escuchando = false;
                guardarAlTerminar = false;

                boton.disabled = false;
                detener.disabled = true;

                estado.textContent =
                    "El reconocimiento se interrumpió.";
            }

            return;
        }

        if (guardarAlTerminar) {
            guardarAlTerminar = false;

            texto.value = textoGuardado.trim();

            const resultados = analizarTexto();

            await guardarConversacion(resultados);
        }
    };
}

// ========================================
// ANÁLISIS DE PALABRAS
// ========================================

function limpiarPalabra(palabra) {
    return palabra
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
}

function analizarTexto() {
    const contenidoOriginal = texto.value.trim();
    const situacion = obtenerSituacion();

    const palabras = contenidoOriginal
        .split(/\s+/)
        .map(limpiarPalabra)
        .filter(Boolean);

    const totalPalabras = palabras.length;

    const listaMuletillas = new Set([
        "eh",
        "em",
        "emm",
        "mmm",
        "umm",
        "este",
        "osea"
    ]);

    let contadorRelleno = 0;

    const frecuencia = {};

    for (const palabra of palabras) {
        if (listaMuletillas.has(palabra)) {
            contadorRelleno++;
        }

        frecuencia[palabra] =
            (frecuencia[palabra] || 0) + 1;
    }

    const palabrasRepetidas = {};

    for (const [palabra, veces] of Object.entries(frecuencia)) {
        if (veces > 1) {
            palabrasRepetidas[palabra] = veces;
        }
    }

    let recomendacionTexto = "";

    if (totalPalabras === 0) {
        recomendacionTexto =
            "No se detectaron palabras. Intenta hablar con claridad.";
    } else if (contadorRelleno > 5) {
        recomendacionTexto =
            "Utilizaste varias muletillas. Intenta hacer pausas " +
            "breves en lugar de repetir sonidos de relleno.";
    } else if (Object.keys(palabrasRepetidas).length > 5) {
        recomendacionTexto =
            "Intenta variar tu vocabulario y evitar " +
            "repeticiones innecesarias.";
    } else {
        recomendacionTexto =
            "Buen trabajo. Continúa practicando la claridad, " +
            "la organización de ideas y la seguridad al hablar.";
    }

    let consejoTexto = "";

    if (situacion === "entrevista") {
        consejoTexto =
            "Para una entrevista laboral, responde de forma " +
            "clara y directa. Explica tus experiencias, destaca " +
            "tus habilidades y utiliza ejemplos concretos.";
    } else {
        consejoTexto =
            "Para una presentación, organiza tus ideas en " +
            "introducción, desarrollo y conclusión. " +
            "Explica el propósito de tu proyecto y sus beneficios.";
    }

    if (cantidadPalabras) {
        cantidadPalabras.textContent =
            "Palabras: " + totalPalabras;
    }

    if (relleno) {
        relleno.textContent =
            "Palabras de relleno: " + contadorRelleno;
    }

    if (repetidas) {
        repetidas.textContent =
            "Palabras repetidas: " +
            Object.keys(palabrasRepetidas).join(", ");
    }

    if (recomendacion) {
        recomendacion.textContent =
            recomendacionTexto;
    }

    if (consejoSituacion) {
        consejoSituacion.textContent =
            consejoTexto;
    }

    return {
        transcripcion: contenidoOriginal,
        situacion: situacion,
        cantidad_palabras: totalPalabras,
        palabras_relleno: contadorRelleno,
        palabras_repetidas: palabrasRepetidas,
        recomendacion: recomendacionTexto,
        consejo_situacion: consejoTexto,
        fecha_inicio: fechaInicio
            ? fechaInicio.toISOString()
            : new Date().toISOString()
    };
}

// ========================================
// CORRECTOR DE DISCURSO
// ========================================

function mejorarDiscurso(transcripcion, situacion) {
    if (!transcripcion || !transcripcion.trim()) {
        return {
            textoMejorado: "",
            cambios: [],
            consejos: []
        };
    }

    let resultado = transcripcion.trim();

    const cambios = [];
    const consejos = [];

    let correcciones = 0;
    let muletillas = 0;
    let repeticiones = 0;

    // Correcciones basadas en expresiones comunes.
    // No es un traductor ni una IA generativa.

    const diccionario = [
        [/\boe\b/giu, "oye"],
        [/\btoy\b/giu, "estoy"],
        [/\btamos\b/giu, "estamos"],
        [/\bpa\b/giu, "para"],
        [/\bna\b/giu, "nada"],
        [/\bcachai\b/giu, "¿entiendes?"],
        [/\bbacán\b/giu, "excelente"],
        [/\bpo\b/giu, ""],
        [/\bporfa\b/giu, "por favor"],
        [/\bprofe\b/giu, "profesor"],
        [/\bpega\b/giu, "trabajo"],
        [/\bonda\b/giu, "forma"],
        [/\bcaleta\b/giu, "mucho"],
        [/\bpiola\b/giu, "tranquilo"],
        [/\bpa que\b/giu, "para que"]
    ];

    for (const [patron, sustitucion] of diccionario) {
        resultado = resultado.replace(
            patron,
            () => {
                correcciones++;
                return sustitucion;
            }
        );
    }

    // Eliminar muletillas que no aportan contenido.
    resultado = resultado.replace(
        /\b(?:eh|em|emm|mmm|umm)\b[\s,]*/giu,
        () => {
            muletillas++;
            return "";
        }
    );

    // Evitar repeticiones consecutivas.
    // Ejemplo: "quiero quiero presentar".
    const patronRepeticion =
        /\b([\p{L}]+)(?:\s+|,\s*)\1\b/giu;

    let anterior;

    do {
        anterior = resultado;

        resultado = resultado.replace(
            patronRepeticion,
            (_, palabra) => {
                repeticiones++;
                return palabra;
            }
        );
    } while (resultado !== anterior);

    // Normalizar espacios y puntuación.
    resultado = resultado
        .replace(/\s+/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .replace(/,{2,}/g, ",")
        .replace(/^[,\s]+/, "")
        .trim();

    if (resultado) {
        resultado =
            resultado.charAt(0).toUpperCase() +
            resultado.slice(1);

        if (!/[.!?]$/.test(resultado)) {
            resultado += ".";
        }
    }

    if (correcciones > 0) {
        cambios.push(
            `Se corrigieron ${correcciones} expresiones informales.`
        );
    }

    if (muletillas > 0) {
        cambios.push(
            `Se eliminaron ${muletillas} muletillas.`
        );
    }

    if (repeticiones > 0) {
        cambios.push(
            `Se eliminaron ${repeticiones} repeticiones consecutivas.`
        );
    }

    if (cambios.length === 0) {
        cambios.push(
            "No se detectaron expresiones del diccionario para corregir."
        );
    }

    if (situacion === "entrevista") {
        consejos.push(
            "Utiliza vocabulario profesional y ejemplos concretos."
        );
        consejos.push(
            "Responde directamente a cada pregunta."
        );
    } else {
        consejos.push(
            "Organiza tu discurso en introducción, desarrollo y conclusión."
        );
        consejos.push(
            "Explica claramente tu idea principal."
        );
    }

    consejos.push(
        "Revisa las correcciones porque algunas expresiones " +
        "pueden cambiar de significado según el contexto."
    );

    return {
        textoMejorado: resultado,
        cambios,
        consejos
    };
}

// ========================================
// PREPARAR TEXTO MEJORADO PARA EL MODAL
// ========================================

function generarTextoMejora(resultados) {
    const mejora = mejorarDiscurso(
        resultados.transcripcion,
        resultados.situacion
    );

    if (!mejora.textoMejorado) {
        return "No se detectó un discurso para mejorar.";
    }

    let contenido = "VERSIÓN MEJORADA:\n\n";
    contenido += mejora.textoMejorado;

    contenido += "\n\nCAMBIOS REALIZADOS:\n";

    for (const cambio of mejora.cambios) {
        contenido += "• " + cambio + "\n";
    }

    contenido +=
        "\nCONSEJOS PARA TU PRÓXIMA PRÁCTICA:\n";

    for (const consejo of mejora.consejos) {
        contenido += "• " + consejo + "\n";
    }

    return contenido.trim();
}

// ========================================
// TOKEN CSRF DE DJANGO
// ========================================

function obtenerCSRFToken() {
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
        const elemento = cookie.trim();

        if (elemento.startsWith("csrftoken=")) {
            return decodeURIComponent(
                elemento.substring(
                    "csrftoken=".length
                )
            );
        }
    }

    return "";
}

// ========================================
// GUARDAR CONVERSACIÓN EN DJANGO
// ========================================

async function guardarConversacion(resultados) {
    if (guardando) return;

    guardando = true;

    boton.disabled = true;
    detener.disabled = true;

    estado.textContent = "Finalizando práctica...";

    // El video se procesa localmente y NO se envía
    // al servidor.
    if (grabandoVideo) {
        detenerGrabacionVideo();
    }

    let guardadoCorrectamente = false;

    if (resultados.transcripcion) {
        estado.textContent = "Guardando conversación...";

        try {
            const respuesta = await fetch(
                "/guardar-conversacion/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": obtenerCSRFToken()
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        transcripcion:
                            resultados.transcripcion,
                        situacion:
                            resultados.situacion,
                        palabras_relleno:
                            resultados.palabras_relleno,
                        palabras_repetidas:
                            resultados.palabras_repetidas,
                        recomendacion:
                            resultados.recomendacion,
                        consejo_situacion:
                            resultados.consejo_situacion,
                        fecha_inicio:
                            resultados.fecha_inicio
                    })
                }
            );

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error ||
                    "No se pudo guardar la conversación."
                );
            }

            guardadoCorrectamente = true;

            estado.textContent =
                "Práctica guardada correctamente.";

        } catch (error) {
            console.error(
                "Error al guardar:",
                error
            );

            estado.textContent =
                "No se pudo guardar la práctica: " +
                error.message;
        }
    } else {
        estado.textContent =
            "No se detectó texto para guardar.";
    }

    guardando = false;
    boton.disabled = false;
    detener.disabled = true;

    if (finalizandoVideo) {
        resultadosPendientes = {
            resultados,
            guardado: guardadoCorrectamente
        };
    } else {
        mostrarVentanaResultados(
            resultados,
            guardadoCorrectamente
        );
    }
}

// ========================================
// MOSTRAR RESULTADOS
// ========================================

function mostrarVentanaResultados(
    resultados,
    guardadoCorrectamente
) {
    if (!ventanaResultados) {
        console.error(
            "No existe la ventana de resultados."
        );
        return;
    }

    if (mensajeGuardado) {
        if (guardadoCorrectamente) {
            mensajeGuardado.textContent =
                "Tu conversación fue guardada en Mi progreso.";
        } else if (!resultados.transcripcion) {
            mensajeGuardado.textContent =
                "La práctica finalizó sin una transcripción.";
        } else {
            mensajeGuardado.textContent =
                "Se generó el análisis, pero no se pudo " +
                "guardar la conversación.";
        }
    }

    if (modalPalabras) {
        modalPalabras.textContent =
            "Palabras: " +
            resultados.cantidad_palabras;
    }

    if (modalMuletillas) {
        modalMuletillas.textContent =
            "Palabras de relleno: " +
            resultados.palabras_relleno;
    }

    const listaRepetidas = Object.entries(
        resultados.palabras_repetidas || {}
    )
        .sort((a, b) => b[1] - a[1])
        .map(
            ([palabra, cantidad]) =>
                `${palabra} (${cantidad} veces)`
        );

    if (modalRepetidas) {
        modalRepetidas.textContent =
            listaRepetidas.length
                ? "Palabras repetidas: " +
                  listaRepetidas.join(", ")
                : "Palabras repetidas: Ninguna";
    }

    if (modalRecomendacion) {
        modalRecomendacion.textContent =
            resultados.recomendacion;
    }

    if (modalConsejo) {
        modalConsejo.textContent =
            resultados.consejo_situacion;
    }

    if (modalMejora) {
        modalMejora.textContent =
            generarTextoMejora(resultados);

        modalMejora.style.whiteSpace =
            "pre-line";
    }

    // VIDEO EN LA MISMA VENTANA
    if (seccionVideoGrabado) {
        seccionVideoGrabado.hidden =
            !urlVideoGrabado;
    }

    if (mensajeVideoResultados) {
        mensajeVideoResultados.hidden =
            Boolean(urlVideoGrabado);

        mensajeVideoResultados.textContent =
            "No hay video de esta práctica. " +
            "Puedes practicar sin cámara.";
    }

    ventanaResultados.hidden = false;

    document.body.classList.add(
        "modal-abierto"
    );

    cerrarResultados?.focus();

    console.log(
        "Resultados mostrados correctamente."
    );
}

// ========================================
// CERRAR RESULTADOS
// ========================================

function ocultarVentanaResultados() {
    if (!ventanaResultados) return;

    if (videoGrabado) {
        videoGrabado.pause();
    }

    ventanaResultados.hidden = true;

    document.body.classList.remove(
        "modal-abierto"
    );

    boton?.focus();
}

cerrarResultados?.addEventListener(
    "click",
    ocultarVentanaResultados
);

volverPractica?.addEventListener(
    "click",
    ocultarVentanaResultados
);

document.addEventListener(
    "keydown",
    function (event) {
        if (
            event.key === "Escape" &&
            ventanaResultados &&
            !ventanaResultados.hidden
        ) {
            ocultarVentanaResultados();
        }
    }
);

ventanaResultados?.addEventListener(
    "click",
    function (event) {
        if (event.target === ventanaResultados) {
            ocultarVentanaResultados();
        }
    }
);

// ========================================
// ACCESIBILIDAD DEL MODAL
// ========================================

document.addEventListener(
    "keydown",
    function (event) {
        if (
            event.key !== "Tab" ||
            !ventanaResultados ||
            ventanaResultados.hidden
        ) {
            return;
        }

        const controles = Array.from(
            ventanaResultados.querySelectorAll(
                "button:not([disabled]), a[href]"
            )
        );

        if (!controles.length) return;

        const primero = controles[0];
        const ultimo = controles[controles.length - 1];

        if (
            event.shiftKey &&
            document.activeElement === primero
        ) {
            event.preventDefault();
            ultimo.focus();
        } else if (
            !event.shiftKey &&
            document.activeElement === ultimo
        ) {
            event.preventDefault();
            primero.focus();
        }
    }
);

// ========================================
// LIBERAR CÁMARA AL SALIR
// ========================================

window.addEventListener("pagehide", function () {
    if (
        grabadorVideo &&
        grabadorVideo.state !== "inactive"
    ) {
        try {
            grabadorVideo.stop();
        } catch (error) {
            console.warn(error);
        }
    }

    grabandoVideo = false;
    finalizandoVideo = false;
    resultadosPendientes = null;

    if (flujoCamara) {
        flujoCamara.getTracks().forEach(
            pista => pista.stop()
        );
        flujoCamara = null;
    }

    limpiarVideoGrabado();
});

// ========================================
// ESTADO INICIAL
// ========================================

if (detener) {
    detener.disabled = true;
}

if (ventanaResultados) {
    ventanaResultados.hidden = true;
}

if (seccionVideoGrabado) {
    seccionVideoGrabado.hidden = true;
}

if (indicadorGrabacion) {
    indicadorGrabacion.hidden = true;
}

actualizarBotonesGrabacion();

console.log("SpeakUP3 listo para practicar.");
