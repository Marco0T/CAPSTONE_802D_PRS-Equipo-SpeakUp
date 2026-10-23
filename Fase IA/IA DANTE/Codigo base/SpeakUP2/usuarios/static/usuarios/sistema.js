
console.log("SISTEMA.JS FUNCIONANDO");

/* ============================= */
/* ELEMENTOS */
/* ============================= */

const boton = document.getElementById("iniciar");
const detener = document.getElementById("detener");

const estado = document.getElementById("estado");
const texto = document.getElementById("texto");

const cantidadPalabras = document.getElementById("cantidadPalabras");
const relleno = document.getElementById("relleno");
const repetidas = document.getElementById("repetidas");
const recomendacion = document.getElementById("recomendacion");
const consejoSituacion = document.getElementById("consejoSituacion");

const situaciones = document.getElementsByName("situacion");

/* ============================= */
/* RECONOCIMIENTO DE VOZ */
/* ============================= */

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let reconocimiento = null;

if (SpeechRecognition) {
    reconocimiento = new SpeechRecognition();
    reconocimiento.lang = "es-CL";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;
} else {
    alert("Tu navegador no soporta reconocimiento de voz.");
}

/* ============================= */
/* VARIABLES */
/* ============================= */

let textoGuardado = "";
let escuchando = false;
let guardarAlTerminar = false;
let guardando = false;
let fechaInicio = null;

/* ============================= */
/* OBTENER SITUACIÓN */
/* ============================= */

function obtenerSituacion() {
    for (const opcion of situaciones) {
        if (opcion.checked) {
            return opcion.value;
        }
    }

    return "presentacion";
}

/* ============================= */
/* COMENZAR PRÁCTICA */
/* ============================= */

boton.onclick = function () {
    if (!reconocimiento || escuchando || guardando) {
        return;
    }

    textoGuardado = "";
    texto.value = "";

    fechaInicio = new Date();
    guardarAlTerminar = false;
    escuchando = true;

    boton.disabled = true;
    detener.disabled = false;

    estado.textContent = "Escuchando...";

    try {
        reconocimiento.start();
    } catch (error) {
        escuchando = false;
        boton.disabled = false;
        estado.textContent = "No se pudo iniciar el micrófono.";
        console.error(error);
    }
};

/* ============================= */
/* DETENER MICRÓFONO */
/* ============================= */

detener.onclick = function () {
    if (!reconocimiento || !escuchando) {
        return;
    }

    escuchando = false;
    guardarAlTerminar = true;

    detener.disabled = true;
    estado.textContent = "Finalizando reconocimiento...";

    reconocimiento.stop();
};

/* ============================= */
/* RESULTADOS DEL RECONOCIMIENTO */
/* ============================= */

if (reconocimiento) {
    reconocimiento.onresult = function (event) {
        let textoTemporal = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {
            const resultado = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                textoGuardado += resultado + " ";
            } else {
                textoTemporal += resultado;
            }
        }

        texto.value = textoGuardado + textoTemporal;
    };

    reconocimiento.onerror = function (event) {
        console.error("Error de reconocimiento:", event.error);

        estado.textContent =
            "Error del micrófono: " + event.error;

        if (event.error === "not-allowed" ||
            event.error === "service-not-allowed") {
            escuchando = false;
            guardarAlTerminar = false;
            boton.disabled = false;
            detener.disabled = true;
        }
    };

    reconocimiento.onend = async function () {
        if (escuchando) {
            // Algunos navegadores terminan el reconocimiento
            // automáticamente. Lo reiniciamos mientras siga activo.
            try {
                reconocimiento.start();
            } catch (error) {
                console.error("No se pudo reanudar:", error);
            }

            return;
        }

        if (guardarAlTerminar) {
            guardarAlTerminar = false;

            // Mostrar también el texto final antes de guardarlo.
            texto.value = textoGuardado.trim();

            const resultados = analizarTexto();

            await guardarConversacion(resultados);
        }
    };
}

/* ============================= */
/* ANALIZAR TEXTO */
/* ============================= */

function analizarTexto() {
    const contenido = textoGuardado.trim().toLowerCase();

    const palabras = contenido
        ? contenido.split(/\s+/).filter(Boolean)
        : [];

    /* CANTIDAD DE PALABRAS */

    cantidadPalabras.textContent =
        "Palabras: " + palabras.length;

    /* PALABRAS DE RELLENO */

    const palabrasRelleno = [
        "eh",
        "em",
        "mmm",
        "bueno",
        "este"
    ];

    let contadorRelleno = 0;

    for (const palabra of palabras) {
        if (palabrasRelleno.includes(palabra)) {
            contadorRelleno++;
        }
    }

    // Contar también la expresión completa "o sea".
    const expresionesOSea =
        contenido.match(/\bo\s+sea\b/g) || [];

    contadorRelleno += expresionesOSea.length;

    relleno.textContent =
        "Palabras de relleno: " + contadorRelleno;

    /* PALABRAS REPETIDAS */

    const contador = {};

    for (const palabra of palabras) {
        contador[palabra] = (contador[palabra] || 0) + 1;
    }

    const palabrasRepetidas = {};

    for (const palabra in contador) {
        if (contador[palabra] > 1) {
            palabrasRepetidas[palabra] = contador[palabra];
        }
    }

    const listaRepetidas = Object.entries(palabrasRepetidas)
        .map(([palabra, cantidad]) =>
            `${palabra} (${cantidad} veces)`
        );

    repetidas.textContent = listaRepetidas.length
        ? "Palabras repetidas: " + listaRepetidas.join(", ")
        : "Palabras repetidas: Ninguna";

    /* RECOMENDACIÓN GENERAL */

    let recomendacionTexto;

    if (contadorRelleno > 3) {
        recomendacionTexto =
            "Intenta reducir las palabras de relleno.";
    } else {
        recomendacionTexto =
            "Buen uso de palabras de relleno.";
    }

    recomendacion.textContent =
        "Recomendación: " + recomendacionTexto;

    /* CONSEJO SEGÚN SITUACIÓN */

    const situacion = obtenerSituacion();
    let consejoTexto = "";

    if (situacion === "presentacion") {
        consejoTexto =
            "Para una presentación, intenta comenzar explicando claramente tu idea, hablar con seguridad y mantener un ritmo constante. Evita usar demasiadas palabras de relleno.";
    } else if (situacion === "entrevista") {
        consejoTexto =
            "Para una entrevista laboral, intenta responder de forma clara y directa. Explica tus experiencias, destaca tus habilidades y evita respuestas demasiado largas.";
    }

    consejoSituacion.textContent = consejoTexto;

    return {
        transcripcion: textoGuardado.trim(),
        situacion: situacion,
        palabras_relleno: contadorRelleno,
        palabras_repetidas: palabrasRepetidas,
        recomendacion: recomendacionTexto,
        consejo_situacion: consejoTexto,
        fecha_inicio: fechaInicio
            ? fechaInicio.toISOString()
            : new Date().toISOString()
    };
}

/* ============================= */
/* OBTENER TOKEN CSRF DE DJANGO */
/* ============================= */

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

/* ============================= */
/* GUARDAR CONVERSACIÓN EN DJANGO */
/* ============================= */

async function guardarConversacion(resultados) {
    if (guardando) {
        return;
    }

    // No guardar prácticas vacías.
    if (!resultados.transcripcion) {
        estado.textContent =
            "Práctica finalizada. No se detectó texto para guardar.";

        boton.disabled = false;
        detener.disabled = true;
        return;
    }

    guardando = true;
    boton.disabled = true;
    detener.disabled = true;

    estado.textContent = "Guardando conversación...";

    try {
        const respuesta = await fetch("/guardar-conversacion/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": obtenerCSRFToken()
            },
            credentials: "same-origin",
            body: JSON.stringify({
                transcripcion: resultados.transcripcion,
                situacion: resultados.situacion,
                palabras_relleno: resultados.palabras_relleno,
                palabras_repetidas: resultados.palabras_repetidas,
                recomendacion: resultados.recomendacion,
                consejo_situacion: resultados.consejo_situacion,
                fecha_inicio: resultados.fecha_inicio
            })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error || "No se pudo guardar la conversación."
            );
        }

        estado.textContent =
            "Práctica guardada correctamente."

    } catch (error) {
        console.error("Error al guardar:", error);

        estado.textContent =
            "No se pudo guardar la práctica. " + error.message;

    } finally {
        guardando = false;
        boton.disabled = false;
        detener.disabled = true;
    }
}

/* ============================= */
/* ESTADO INICIAL */
/* ============================= */

detener.disabled = true;
