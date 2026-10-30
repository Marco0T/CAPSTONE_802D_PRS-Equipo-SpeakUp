console.log("SPEAKUP - RECONOCIMIENTO Y REPETICIONES MEJORADAS");


/* =====================================================
   ELEMENTOS DE LA INTERFAZ
===================================================== */

const boton = document.getElementById("iniciar");
const detener = document.getElementById("detener");

const estado = document.getElementById("estado");
const texto = document.getElementById("texto");

const cantidadPalabras = document.getElementById("cantidadPalabras");
const relleno = document.getElementById("relleno");
const repetidas = document.getElementById("repetidas");

const situaciones = document.getElementsByName("situacion");

const salidaIA = document.getElementById("texto-seguimiento-ia");

const modal = document.getElementById("modal-resultados");
const cargaIA = document.getElementById("carga-ia");

const contenidoResultados = document.getElementById(
    "contenido-resultados"
);

const cerrarModal = document.getElementById("cerrar-modal");

const cerrarResultados = document.getElementById(
    "cerrar-resultados"
);


/* =====================================================
   RECONOCIMIENTO DE VOZ
===================================================== */

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

    estado.textContent =
        "Tu navegador no soporta reconocimiento de voz.";

    boton.disabled = true;

}


/* =====================================================
   VARIABLES
===================================================== */

let textoGuardado = "";
let escuchando = false;
let guardarAlTerminar = false;
let guardando = false;
let fechaInicio = null;

let situacionPractica = "presentacion";
let modalAbierto = false;


/* =====================================================
   MULETILLAS
===================================================== */

const muletillasSimples = new Set([
    "eh",
    "em",
    "mmm",
    "mm",
    "este",
    "bueno",
    "digamos"
]);


/* =====================================================
   NORMALIZAR TEXTO
===================================================== */

function normalizarTexto(contenido) {

    return String(contenido || "")
        .normalize("NFC")
        .toLowerCase();

}


/* =====================================================
   OBTENER PALABRAS
===================================================== */

function obtenerPalabras(contenido) {

    return normalizarTexto(contenido).match(
        /[a-záéíóúüñ]+(?:['’][a-záéíóúüñ]+)?/g
    ) || [];

}


/* =====================================================
   OBTENER SITUACIÓN
===================================================== */

function obtenerSituacion() {

    for (const opcion of situaciones) {

        if (opcion.checked) {
            return opcion.value;
        }

    }

    return "presentacion";

}


/* =====================================================
   DETECTAR MULETILLAS
===================================================== */

function detectarMuletillas(palabras) {

    const encontradas = {};
    let total = 0;

    for (let i = 0; i < palabras.length; i++) {

        const palabra = palabras[i];

        if (
            palabra === "o" &&
            i + 1 < palabras.length &&
            palabras[i + 1] === "sea"
        ) {

            encontradas["o sea"] =
                (encontradas["o sea"] || 0) + 1;

            total++;
            i++;

            continue;

        }

        if (muletillasSimples.has(palabra)) {

            encontradas[palabra] =
                (encontradas[palabra] || 0) + 1;

            total++;

        }

    }

    return {
        total,
        detalle: encontradas
    };

}


/* =====================================================
   DETECTAR REPETICIONES DE PALABRAS Y FRASES
===================================================== */

/*
    Ejemplos:

    "quizás quizás"
        -> quizás: 1 repetición

    "me acuerdo, me acuerdo"
        -> me acuerdo: 1 repetición

    "me acuerdo, me acuerdo, me acuerdo"
        -> me acuerdo: 2 repeticiones

    "creo que sí, creo que sí"
        -> creo que sí: 1 repetición

    Las frases más largas tienen prioridad para
    evitar contar varias veces la misma repetición.
*/

function detectarRepeticiones(palabras) {

    const repeticiones = {};

    let i = 0;

    while (i < palabras.length) {

        let longitudEncontrada = 0;
        let cantidadRepeticiones = 0;
        let fraseEncontrada = "";

        // Buscar primero frases de 3 palabras,
        // luego de 2 y finalmente palabras individuales.

        for (let longitud = 3; longitud >= 1; longitud--) {

            if (i + longitud * 2 > palabras.length) {
                continue;
            }

            const frase = palabras.slice(
                i,
                i + longitud
            );

            let posicion = i + longitud;
            let repeticionesActuales = 0;

            while (
                posicion + longitud <= palabras.length
            ) {

                const siguiente = palabras.slice(
                    posicion,
                    posicion + longitud
                );

                const iguales = frase.every(
                    (palabra, indice) =>
                        palabra === siguiente[indice]
                );

                if (!iguales) {
                    break;
                }

                repeticionesActuales++;
                posicion += longitud;

            }

            if (repeticionesActuales > 0) {

                longitudEncontrada = longitud;

                cantidadRepeticiones =
                    repeticionesActuales;

                fraseEncontrada = frase.join(" ");

                break;

            }

        }

        if (longitudEncontrada > 0) {

            repeticiones[fraseEncontrada] =
                (repeticiones[fraseEncontrada] || 0) +
                cantidadRepeticiones;

            // Saltar toda la secuencia ya analizada.

            i += longitudEncontrada *
                (cantidadRepeticiones + 1);

        } else {

            i++;

        }

    }

    return repeticiones;

}


/* =====================================================
   ABRIR VENTANA EMERGENTE
===================================================== */

function abrirModal() {

    if (!modal) {
        return;
    }

    modal.classList.add("activo");
    modalAbierto = true;

    document.body.style.overflow = "hidden";

    if (cerrarModal) {
        cerrarModal.focus();
    }

}


/* =====================================================
   CERRAR VENTANA EMERGENTE
===================================================== */

function cerrarVentanaModal() {

    if (!modal) {
        return;
    }

    modal.classList.remove("activo");
    modalAbierto = false;

    document.body.style.overflow = "";

    boton.focus();

}


/* =====================================================
   MOSTRAR CARGA
===================================================== */

function mostrarCarga() {

    if (cargaIA) {
        cargaIA.style.display = "block";
    }

    if (contenidoResultados) {
        contenidoResultados.style.display = "none";
    }

    if (salidaIA) {
        salidaIA.textContent = "Preparando evaluación...";
    }

}


/* =====================================================
   MOSTRAR RESULTADOS
===================================================== */

function mostrarResultados() {

    if (cargaIA) {
        cargaIA.style.display = "none";
    }

    if (contenidoResultados) {
        contenidoResultados.style.display = "block";
    }

}


/* =====================================================
   EVENTOS DEL MODAL
===================================================== */

if (cerrarModal) {

    cerrarModal.addEventListener(
        "click",
        cerrarVentanaModal
    );

}

if (cerrarResultados) {

    cerrarResultados.addEventListener(
        "click",
        cerrarVentanaModal
    );

}

document.addEventListener("keydown", function (event) {

    if (
        event.key === "Escape" &&
        modalAbierto
    ) {

        cerrarVentanaModal();

    }

});

if (modal) {

    modal.addEventListener("click", function (event) {

        if (event.target === modal) {
            cerrarVentanaModal();
        }

    });

}


/* =====================================================
   INICIAR PRÁCTICA
===================================================== */

boton.onclick = function () {

    if (
        !reconocimiento ||
        escuchando ||
        guardando
    ) {
        return;
    }

    textoGuardado = "";
    texto.value = "";

    fechaInicio = new Date();

    situacionPractica = obtenerSituacion();

    guardarAlTerminar = false;
    escuchando = true;

    boton.disabled = true;
    detener.disabled = false;

    estado.textContent = "🎤 Escuchando...";

    cantidadPalabras.textContent = "0";
    relleno.textContent = "0";
    repetidas.textContent = "Ninguna";

    if (salidaIA) {
        salidaIA.textContent = "Preparando evaluación...";
    }

    if (modalAbierto) {
        cerrarVentanaModal();
    }

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

};


/* =====================================================
   DETENER MICRÓFONO
===================================================== */

detener.onclick = function () {

    if (!reconocimiento || !escuchando) {
        return;
    }

    escuchando = false;
    guardarAlTerminar = true;

    detener.disabled = true;
    boton.disabled = true;

    estado.textContent =
        "Finalizando reconocimiento...";

    mostrarCarga();
    abrirModal();

    try {

        reconocimiento.stop();

    } catch (error) {

        console.error(error);
        finalizarPractica();

    }

};


/* =====================================================
   EVENTOS DEL RECONOCIMIENTO
===================================================== */

if (reconocimiento) {

    reconocimiento.onresult = function (event) {

        let textoTemporal = "";

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

                textoTemporal += resultado;

            }

        }

        texto.value =
            textoGuardado + textoTemporal;

        texto.scrollTop = texto.scrollHeight;

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

        }

    };


    reconocimiento.onend = function () {

        if (escuchando) {

            try {

                reconocimiento.start();

            } catch (error) {

                console.error(error);

                escuchando = false;

                boton.disabled = false;
                detener.disabled = true;

                estado.textContent =
                    "El reconocimiento se detuvo.";

            }

            return;

        }

        if (guardarAlTerminar) {
            finalizarPractica();
        }

    };

}


/* =====================================================
   FINALIZAR PRÁCTICA
===================================================== */

async function finalizarPractica() {

    if (!guardarAlTerminar || guardando) {
        return;
    }

    guardarAlTerminar = false;

    texto.value = textoGuardado.trim();

    const resultados = analizarTexto();

    await guardarConversacion(resultados);

}


/* =====================================================
   ANALIZAR TEXTO
===================================================== */

function analizarTexto() {

    const contenido = textoGuardado.trim();

    const palabras = obtenerPalabras(contenido);

    const totalPalabras = palabras.length;

    cantidadPalabras.textContent =
        String(totalPalabras);


    // MULETILLAS

    const resultadoMuletillas =
        detectarMuletillas(palabras);

    const contadorRelleno =
        resultadoMuletillas.total;

    relleno.textContent =
        String(contadorRelleno);


    // REPETICIONES DE PALABRAS Y FRASES

    const palabrasRepetidas =
        detectarRepeticiones(palabras);

    const listaRepetidas = Object.entries(
        palabrasRepetidas
    ).map(([frase, cantidad]) => {

        return `${frase}: ${cantidad} repetición(es)`;

    });

    repetidas.textContent =
        listaRepetidas.length > 0
            ? listaRepetidas.join(", ")
            : "Ninguna";


    // DATOS PARA DJANGO

    return {

        transcripcion: contenido,

        situacion: situacionPractica,

        palabras_relleno: contadorRelleno,

        palabras_repetidas: palabrasRepetidas,

        recomendacion: "",

        consejo_situacion: "",

        fecha_inicio: fechaInicio
            ? fechaInicio.toISOString()
            : new Date().toISOString()

    };

}


/* =====================================================
   TOKEN CSRF
===================================================== */

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


/* =====================================================
   GUARDAR CONVERSACIÓN
===================================================== */

async function guardarConversacion(resultados) {

    if (guardando) {
        return;
    }

    if (!resultados.transcripcion) {

        estado.textContent =
            "No se detectó texto para guardar.";

        if (salidaIA) {

            salidaIA.textContent =
                "No se detectó ninguna transcripción. " +
                "Intenta realizar otra práctica.";

        }

        mostrarResultados();

        boton.disabled = false;
        detener.disabled = true;

        return;

    }

    guardando = true;

    boton.disabled = true;
    detener.disabled = true;

    estado.textContent =
        "Guardando práctica y analizando con IA...";

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

                    recomendacion: "",

                    consejo_situacion: "",

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

        estado.textContent =
            "Práctica guardada correctamente.";

        if (salidaIA) {

            if (datos.seguimiento_ia) {

                salidaIA.textContent =
                    datos.seguimiento_ia;

                if (datos.estado_ia !== "completado") {

                    salidaIA.textContent +=
                        "\n\n(Se utilizó el análisis de respaldo " +
                        "porque la IA local no completó la evaluación.)";

                }

            } else {

                salidaIA.textContent =
                    "La práctica se guardó, pero no se obtuvo " +
                    "una evaluación de IA.";

            }

        }

        mostrarResultados();

    } catch (error) {

        console.error(
            "Error al guardar:",
            error
        );

        estado.textContent =
            "No se pudo completar el guardado.";

        if (salidaIA) {

            salidaIA.textContent =
                "Ocurrió un problema al guardar la práctica: " +
                error.message;

        }

        mostrarResultados();

    } finally {

        guardando = false;

        boton.disabled = false;
        detener.disabled = true;

    }

}


/* =====================================================
   ESTADO INICIAL
===================================================== */

detener.disabled = true;

cantidadPalabras.textContent = "0";
relleno.textContent = "0";
repetidas.textContent = "Ninguna";