console.log("SPEAKUP - RECONOCIMIENTO DE VOZ Y MEDIAPIPE");


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

// Tema visual dinámico: presentación conserva los colores originales.
function actualizarTemaSituacion() {
    const seleccionada = Array.from(situaciones).find(opcion => opcion.checked);
    const entrevista = seleccionada?.value === "entrevista";
    document.body.classList.toggle("modo-entrevista", entrevista);
    document.documentElement.dataset.modoSpeakup = entrevista ? "entrevista" : "presentacion";
}
for (const opcion of situaciones) {
    opcion.addEventListener("change", actualizarTemaSituacion);
}
actualizarTemaSituacion();


const salidaIA = document.getElementById("texto-seguimiento-ia");

const bloqueResultadosVisuales = document.getElementById(
    "bloque-resultados-visuales"
);

const textoResultadosVisuales = document.getElementById(
    "texto-resultados-visuales"
);

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

    if (estado) {
        estado.textContent =
            "Tu navegador no soporta reconocimiento de voz.";
    }

    if (boton) {
        boton.disabled = true;
    }
}


/* =====================================================
   VARIABLES GENERALES
===================================================== */

let textoGuardado = "";

let escuchando = false;

let guardarAlTerminar = false;

let guardando = false;

let fechaInicio = null;

let situacionPractica = "presentacion";

let modalAbierto = false;

// Estadísticas visuales de la práctica actual.
let resultadosVisuales = {};

// Indica si MediaPipe participó en esta práctica.
let camaraParticipando = false;


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
   DETECTAR REPETICIONES
===================================================== */

function detectarRepeticiones(palabras) {

    const repeticiones = {};

    let i = 0;

    while (i < palabras.length) {

        let longitudEncontrada = 0;

        let cantidadRepeticiones = 0;

        let fraseEncontrada = "";

        // Priorizar frases de tres palabras,
        // luego dos y finalmente una.

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

            i += longitudEncontrada *
                (cantidadRepeticiones + 1);

        } else {

            i++;
        }
    }

    return repeticiones;
}


/* =====================================================
   FASE 3 - COMUNICACIÓN CON MEDIAPIPE
===================================================== */

/*
    camara.js expone:

    window.SpeakUPCamara = {
        iniciarPractica(),
        finalizarPractica(),
        obtenerResultados(),
        detener(),
        estaActiva()
    }

    La cámara es opcional.

    Si MediaPipe no está disponible,
    SpeakUP continúa con el análisis verbal.
*/


function obtenerControlCamara() {

    const control = window.SpeakUPCamara;

    if (!control) {
        return null;
    }

    return control;
}


/* =====================================================
   COMPROBAR SI LA CÁMARA ESTÁ ACTIVA
===================================================== */

function camaraEstaActiva() {

    const control = obtenerControlCamara();

    if (
        !control ||
        typeof control.estaActiva !== "function"
    ) {
        return false;
    }

    try {

        return Boolean(
            control.estaActiva()
        );

    } catch (error) {

        console.warn(
            "No se pudo consultar la cámara:",
            error
        );

        return false;
    }
}


/* =====================================================
   NORMALIZAR RESULTADOS VISUALES
===================================================== */

function normalizarResultadosVisuales(datos) {

    if (
        !datos ||
        typeof datos !== "object" ||
        Array.isArray(datos)
    ) {
        return {};
    }

    const resultado = {};

    // Estos nombres coinciden con views.py.

    const porcentajes = [
        "rostro_visible",
        "orientacion_frontal",
        "mirada_camara_estimada",
        "estabilidad_corporal",
        "hombros_visibles",
        "manos_visibles"
    ];

    const contadores = [
        "movimientos_manos",
        "inclinaciones_cabeza",
        "cambios_orientacion_cabeza",
        "fotogramas_analizados"
    ];

    // =====================================
    // PORCENTAJES
    // =====================================

    for (const clave of porcentajes) {

        const valor = datos[clave];

        if (
            typeof valor === "number" &&
            Number.isFinite(valor) &&
            valor >= 0 &&
            valor <= 100
        ) {

            resultado[clave] = Math.round(
                valor * 100
            ) / 100;
        }
    }

    // =====================================
    // CONTADORES
    // =====================================

    for (const clave of contadores) {

        const valor = datos[clave];

        if (
            Number.isInteger(valor) &&
            valor >= 0
        ) {

            resultado[clave] = valor;
        }
    }

    // Django exige al menos un fotograma
    // analizado para aceptar las estadísticas.

    if (
        !resultado.fotogramas_analizados ||
        resultado.fotogramas_analizados <= 0
    ) {
        return {};
    }

    return resultado;
}


/* =====================================================
   INICIAR REGISTRO VISUAL DE LA PRÁCTICA
===================================================== */

function iniciarAnalisisVisual() {

    resultadosVisuales = {};

    camaraParticipando = false;

    const control = obtenerControlCamara();

    if (!control) {

        console.log(
            "MediaPipe no está disponible. " +
            "Se realizará análisis verbal."
        );

        return;
    }

    // La cámara puede estar encendida antes
    // de que comience el reconocimiento de voz.

    if (camaraEstaActiva()) {

        camaraParticipando = true;

        console.log(
            "La cámara está activa al iniciar " +
            "la práctica."
        );
    }

    // Reiniciar las estadísticas visuales
    // para esta nueva práctica.

    if (
        typeof control.iniciarPractica === "function"
    ) {

        try {

            control.iniciarPractica();

        } catch (error) {

            console.warn(
                "No se pudo iniciar el registro visual:",
                error
            );
        }
    }
}


/* =====================================================
   FINALIZAR REGISTRO VISUAL
===================================================== */

function finalizarAnalisisVisual() {

    const control = obtenerControlCamara();

    if (!control) {
        return {};
    }

    try {

        // Si la cámara se activó después de
        // comenzar la práctica, también se
        // considera que participó.

        if (camaraEstaActiva()) {
            camaraParticipando = true;
        }

        // Congelar las estadísticas visuales
        // de la práctica actual.

        if (
            typeof control.finalizarPractica === "function"
        ) {

            control.finalizarPractica();
        }

        if (
            typeof control.obtenerResultados !== "function"
        ) {

            return {};
        }

        const datos = control.obtenerResultados();

        const normalizados =
            normalizarResultadosVisuales(datos);

        resultadosVisuales = normalizados;

        if (Object.keys(normalizados).length > 0) {

            console.log(
                "Resultados de MediaPipe:",
                normalizados
            );

        } else {

            console.log(
                "La práctica no generó " +
                "estadísticas visuales válidas."
            );
        }

        return normalizados;

    } catch (error) {

        console.error(
            "Error al recopilar estadísticas visuales:",
            error
        );

        resultadosVisuales = {};

        return {};
    }
}


/* =====================================================
   FASE 3 - MOSTRAR RESULTADOS VISUALES EN EL MODAL
===================================================== */

function mostrarResultadosVisuales(datos) {

    if (
        !bloqueResultadosVisuales ||
        !textoResultadosVisuales
    ) {
        return;
    }

    // Si no hay resultados visuales válidos,
    // ocultamos esta sección.

    if (
        !datos ||
        typeof datos !== "object" ||
        !datos.fotogramas_analizados
    ) {

        bloqueResultadosVisuales.style.display = "none";

        textoResultadosVisuales.textContent = "";

        return;
    }

    // =====================================
    // FORMATEAR PORCENTAJES
    // =====================================

    function porcentaje(valor) {

        if (
            typeof valor !== "number" ||
            !Number.isFinite(valor)
        ) {
            return "Sin datos";
        }

        return `${valor.toFixed(1)}%`;
    }

    // =====================================
    // FORMATEAR CONTADORES
    // =====================================

    function contador(valor) {

        if (
            !Number.isInteger(valor) ||
            valor < 0
        ) {
            return "Sin datos";
        }

        return String(valor);
    }

    // =====================================
    // CONSTRUIR RESULTADOS
    // =====================================

    const lineas = [

        "📷 PRESENCIA FRENTE A LA CÁMARA",

        `Rostro visible: ${porcentaje(datos.rostro_visible)}`,

        `Orientación frontal: ${porcentaje(datos.orientacion_frontal)}`,

        `Orientación hacia la cámara (estimada): ${porcentaje(datos.mirada_camara_estimada)}`,

        "",

        "🧍 POSTURA CORPORAL",

        `Estabilidad corporal aproximada: ${porcentaje(datos.estabilidad_corporal)}`,

        `Hombros visibles: ${porcentaje(datos.hombros_visibles)}`,

        "",

        "🙌 MOVIMIENTO DE MANOS",

        `Manos visibles: ${porcentaje(datos.manos_visibles)}`,

        `Movimientos detectados: ${contador(datos.movimientos_manos)}`,

        "",

        "🙂 MOVIMIENTOS DE CABEZA",

        `Inclinaciones detectadas: ${contador(datos.inclinaciones_cabeza)}`,

        `Cambios de orientación: ${contador(datos.cambios_orientacion_cabeza)}`,

        "",

        `Fotogramas analizados: ${contador(datos.fotogramas_analizados)}`,

        "",

        "Nota: las métricas son aproximadas y no permiten determinar emociones ni estados psicológicos."
    ];

    // Recomendaciones interpretables, sin atribuir emociones ni calificar
    // movimientos como errores por sí solos.
    const consejos = [];
    if (datos.rostro_visible < 60) {
        consejos.push("Ajusta iluminación y encuadre: el rostro no se detectó durante buena parte de la práctica.");
    }
    if (datos.rostro_visible >= 60 && datos.orientacion_frontal < 55) {
        consejos.push("Practica orientar la cabeza hacia la cámara en las ideas clave, sin mantener una postura rígida.");
    }
    if (datos.hombros_visibles < 50) {
        consejos.push("Sitúate un poco más lejos de la cámara para que ambos hombros entren en el encuadre.");
    }
    if (datos.hombros_visibles >= 60 && datos.estabilidad_corporal < 40) {
        consejos.push("Prueba una postura cómoda y evita desplazarte fuera del encuadre mientras respondes.");
    }
    if (datos.manos_visibles < 30) {
        consejos.push("Si quieres practicar gestos, amplía el encuadre para incluir las manos; su ausencia no significa mala comunicación.");
    }
    if (!consejos.length) {
        consejos.push("La cámara registró tu presencia y postura. Revisa si tus gestos acompañaron tus ideas de forma natural.");
    }
    lineas.push("", "💡 FEEDBACK VISUAL", ...consejos.map(c => "• " + c));
    lineas.push("La orientación de cabeza no equivale a contacto visual real.");

    textoResultadosVisuales.textContent = lineas.join("\n");

    bloqueResultadosVisuales.style.display = "block";

    console.log(
        "Estadísticas visuales mostradas en el modal:",
        datos
    );
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

    if (boton) {
        boton.focus();
    }
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

        salidaIA.textContent =
            "Preparando evaluación verbal y visual...";
    }
}


/* =====================================================
   MOSTRAR RESULTADOS
===================================================== */

function mostrarResultadosVoz() {

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

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            modalAbierto
        ) {

            cerrarVentanaModal();
        }
    }
);

if (modal) {

    modal.addEventListener(
        "click",
        function (event) {

            if (event.target === modal) {

                cerrarVentanaModal();
            }
        }
    );
}


/* =====================================================
   INICIAR PRÁCTICA
===================================================== */

if (boton) {

    boton.onclick = function () {

        if (
            !reconocimiento ||
            escuchando ||
            guardando
        ) {
            return;
        }

        // =====================================
        // REINICIAR TRANSCRIPCIÓN
        // =====================================

        textoGuardado = "";

        texto.value = "";

        fechaInicio = new Date();

        situacionPractica = obtenerSituacion();

        guardarAlTerminar = false;

        escuchando = true;

        // =====================================
        // CONFIGURAR BOTONES
        // =====================================

        boton.disabled = true;

        detener.disabled = false;

        estado.textContent = "🎤 Escuchando...";

        // =====================================
        // REINICIAR MÉTRICAS VERBALES
        // =====================================

        cantidadPalabras.textContent = "0";

        relleno.textContent = "0";

        repetidas.textContent = "Ninguna";

        // =====================================
        // REINICIAR MÉTRICAS VISUALES
        // =====================================

        resultadosVisuales = {};

        camaraParticipando = false;

        // Ocultar los resultados visuales
        // correspondientes a otra práctica.

        mostrarResultadosVisuales({});

        // =====================================
        // REINICIAR EVALUACIÓN DE IA
        // =====================================

        if (salidaIA) {

            salidaIA.textContent =
                "Preparando evaluación...";
        }

        // =====================================
        // CERRAR MODAL ANTERIOR
        // =====================================

        if (modalAbierto) {

            cerrarVentanaModal();
        }

        // =====================================
        // INICIAR RECONOCIMIENTO
        // =====================================

        try {

            reconocimiento.start();

            // Iniciar el registro visual
            // de MediaPipe, si está disponible.

            iniciarAnalisisVisual();

            console.log(
                "Práctica iniciada:",
                situacionPractica
            );

        } catch (error) {

            console.error(
                "Error al iniciar el micrófono:",
                error
            );

            escuchando = false;

            boton.disabled = false;

            detener.disabled = true;

            estado.textContent =
                "No se pudo iniciar el micrófono.";
        }
    };
}


/* =====================================================
   DETENER PRÁCTICA
===================================================== */

let temporizadorFinalizacion = null;

if (detener) {

    detener.onclick = function () {

        if (!reconocimiento || !escuchando) {
            return;
        }

        console.log("SPEAKUP: botón Detener presionado");

        escuchando = false;
        guardarAlTerminar = true;

        detener.disabled = true;
        boton.disabled = true;

        estado.textContent = "Finalizando reconocimiento...";

        // Congelar los resultados de MediaPipe.
        finalizarAnalisisVisual();

        // Abrir el modal mientras se finaliza la práctica.
        mostrarCarga();
        abrirModal();

        // Evitar temporizadores anteriores.
        if (temporizadorFinalizacion !== null) {
            clearTimeout(temporizadorFinalizacion);
        }

        // Respaldo si el navegador no ejecuta onend.
        temporizadorFinalizacion = setTimeout(() => {

            temporizadorFinalizacion = null;

            if (guardarAlTerminar && !guardando) {

                console.warn(
                    "SPEAKUP: onend no finalizó la práctica. " +
                    "Ejecutando finalización de respaldo."
                );

                void finalizarPracticaVoz();
            }

        }, 2500);

        try {

            reconocimiento.stop();

        } catch (error) {

            console.error(
                "Error al detener el reconocimiento:",
                error
            );

            if (temporizadorFinalizacion !== null) {
                clearTimeout(temporizadorFinalizacion);
                temporizadorFinalizacion = null;
            }

            void finalizarPracticaVoz();
        }
    };
}


/* =====================================================
   EVENTOS DEL RECONOCIMIENTO DE VOZ
===================================================== */

if (reconocimiento) {

    /* =================================================
       TRANSCRIPCIÓN EN TIEMPO REAL
    ================================================= */

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


    /* =================================================
       ERRORES DEL RECONOCIMIENTO
    ================================================= */

    reconocimiento.onerror = function (event) {

        console.error(
            "Error de reconocimiento:",
            event.error
        );

        estado.textContent =
            "Error del micrófono: " +
            event.error;

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            escuchando = false;

            guardarAlTerminar = false;

            boton.disabled = false;

            detener.disabled = true;

            // No guardar una práctica
            // que no pudo iniciarse.

            finalizarAnalisisVisual();

            console.warn(
                "El navegador no permitió " +
                "utilizar el micrófono."
            );
        }
    };


    /* =================================================
       FINALIZACIÓN DEL RECONOCIMIENTO
    ================================================= */

    reconocimiento.onend = function () {

        // Si la práctica sigue activa,
        // intentar reiniciar el reconocimiento.

        if (escuchando) {

            try {

                reconocimiento.start();

            } catch (error) {

                console.error(
                    "No se pudo reiniciar el reconocimiento:",
                    error
                );

                escuchando = false;

                boton.disabled = false;

                detener.disabled = true;

                estado.textContent =
                    "El reconocimiento se detuvo.";

                finalizarAnalisisVisual();
            }

            return;
        }

        // Si el usuario presionó Detener,
        // analizar y guardar la práctica.

        if (guardarAlTerminar) {

           void finalizarPracticaVoz();
        }
    };
}


/* =====================================================
   FINALIZAR PRÁCTICA
===================================================== */



async function finalizarPracticaVoz() {

    console.log("SPEAKUP: finalizarPractica iniciada");

    if (!guardarAlTerminar || guardando) {
        console.log(
            "SPEAKUP: finalización omitida",
            { guardarAlTerminar, guardando }
        );
        return;
    }

    // Impedir que onend y el temporizador
    // ejecuten dos veces la misma finalización.
    guardarAlTerminar = false;

    if (temporizadorFinalizacion !== null) {
        clearTimeout(temporizadorFinalizacion);
        temporizadorFinalizacion = null;
    }

    // Recuperar la transcripción final.
    const transcripcionActual = texto.value.trim();

    if (transcripcionActual) {
        textoGuardado = transcripcionActual;
    }

    texto.value = textoGuardado.trim();

    console.log(
        "SPEAKUP: transcripción final:",
        textoGuardado
    );

    try {

        // Calcular las estadísticas de voz.
        const resultados = analizarTexto();

        // Incorporar MediaPipe, si se utilizó.
        resultados.analisis_visual = resultadosVisuales;

        mostrarResultadosVisuales(
            resultados.analisis_visual
        );

        // Mostrar resultados sin esperar a Ollama.
        mostrarResultadosVoz();

        if (salidaIA) {
            salidaIA.textContent =
                "Preparando evaluación con Qwen2.5...";
        }

        estado.textContent =
            "Resultados calculados. Guardando práctica...";

        console.log(
            "SPEAKUP: enviando conversación a Django",
            resultados
        );

        await guardarConversacion(resultados);

        console.log(
            "SPEAKUP: guardarConversacion finalizada"
        );

    } catch (error) {

        console.error(
            "SPEAKUP: error al finalizar práctica:",
            error
        );

        estado.textContent =
            "Ocurrió un error al finalizar la práctica.";

        if (salidaIA) {
            salidaIA.textContent =
                "No se pudo finalizar la práctica: " +
                error.message;
        }

        mostrarResultadosVoz();

        guardando = false;
        boton.disabled = false;
        detener.disabled = true;
    }
}


/* =====================================================
   ANALIZAR TEXTO
===================================================== */

function analizarTexto() {

    const contenido = textoGuardado.trim();

    const palabras = obtenerPalabras(
        contenido
    );

    const totalPalabras = palabras.length;

    // =====================================
    // CONTAR PALABRAS
    // =====================================

    cantidadPalabras.textContent =
        String(totalPalabras);

    // =====================================
    // DETECTAR MULETILLAS
    // =====================================

    const resultadoMuletillas =
        detectarMuletillas(palabras);

    const contadorRelleno =
        resultadoMuletillas.total;

    relleno.textContent =
        String(contadorRelleno);

    // =====================================
    // DETECTAR REPETICIONES
    // =====================================

    const palabrasRepetidas =
        detectarRepeticiones(palabras);

    const listaRepetidas = Object.entries(
        palabrasRepetidas
    ).map(([frase, cantidad]) => {

        return (
            `${frase}: ${cantidad} repetición(es)`
        );
    });

    repetidas.textContent =
        listaRepetidas.length > 0
            ? listaRepetidas.join(", ")
            : "Ninguna";

    // =====================================
    // PREPARAR RESULTADOS PARA DJANGO
    // =====================================

    return {

        transcripcion: contenido,

        situacion: situacionPractica,

        palabras_relleno: contadorRelleno,

        palabras_repetidas: palabrasRepetidas,

        recomendacion: "",

        consejo_situacion: "",

        fecha_inicio: fechaInicio
            ? fechaInicio.toISOString()
            : new Date().toISOString(),

        // =====================================
        // FASE 3 - DATOS DE MEDIAPIPE
        // =====================================

        analisis_visual: resultadosVisuales
    };
}


/* =====================================================
   OBTENER TOKEN CSRF
===================================================== */

function obtenerCSRFToken() {

    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {

        const elemento = cookie.trim();

        if (
            elemento.startsWith("csrftoken=")
        ) {

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
   GUARDAR CONVERSACIÓN EN DJANGO
===================================================== */

async function guardarConversacion(resultados) {

    if (guardando) {
        return;
    }

    // =====================================
    // VALIDAR TRANSCRIPCIÓN
    // =====================================

    if (!resultados.transcripcion) {

        estado.textContent =
            "No se detectó texto para guardar.";

        if (salidaIA) {

            salidaIA.textContent =
                "No se detectó ninguna transcripción. " +
                "Intenta realizar otra práctica.";
        }

        mostrarResultadosVoz();

        boton.disabled = false;

        detener.disabled = true;

        return;
    }

    // =====================================
    // BLOQUEAR BOTONES DURANTE GUARDADO
    // =====================================

    guardando = true;

    boton.disabled = true;

    detener.disabled = true;

    estado.textContent =
        "Estadisticas listas. Guardando practica...";

    try {

        // =====================================
        // ENVIAR DATOS A DJANGO
        // =====================================

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
                        resultados.fecha_inicio,

                    // =================================
                    // FASE 3 - DATOS DE MEDIAPIPE
                    // =================================

                    analisis_visual:
                        resultados.analisis_visual || {}
                })
            }
        );

        // =====================================
        // LEER RESPUESTA DEL SERVIDOR
        // =====================================

        const datos = await respuesta.json();

        if (!respuesta.ok) {

            throw new Error(
                datos.error ||
                "No se pudo guardar la conversación."
            );
        }

        // =====================================
        // CONFIRMAR GUARDADO
        // =====================================

        estado.textContent =
            "Práctica guardada correctamente.";

        // =====================================
        // RESULTADOS DE QWEN2.5 EN SEGUNDO PLANO
        // =====================================
        if (salidaIA) {
            salidaIA.textContent =
                "Práctica guardada. Qwen2.5 está preparando tu evaluación; " +
                "las estadísticas ya están disponibles.";
        }
        mostrarResultadosVoz();
        if (datos.conversacion_id) {
            void esperarSeguimientoIA(datos.conversacion_id);
        }

        // =====================================
        // CONFIRMACIÓN DE MEDIAPIPE
        // =====================================

        if (datos.camara_utilizada) {

            console.log(
                "Análisis visual guardado:",
                datos.analisis_visual
            );

            // Mostrar los datos que confirmó
            // el servidor, si están disponibles.

            if (
                datos.analisis_visual &&
                typeof datos.analisis_visual === "object"
            ) {

                mostrarResultadosVisuales(
                    datos.analisis_visual
                );
            }

        } else {

            console.log(
                "Práctica guardada sin análisis visual."
            );
        }

        // =====================================
        // MOSTRAR RESULTADOS FINALES
        // =====================================

        mostrarResultadosVoz();

    } catch (error) {

        console.error(
            "Error al guardar:",
            error
        );

        estado.textContent =
            "No se pudo completar el guardado.";

        if (salidaIA) {

            salidaIA.textContent =
                "Ocurrió un problema al guardar " +
                "la práctica: " +
                error.message;
        }

        // Aunque falle el servidor,
        // conservar los resultados visuales
        // calculados localmente en el modal.

        mostrarResultadosVisuales(
            resultados.analisis_visual || {}
        );

        mostrarResultadosVoz();

    } finally {

        // =====================================
        // RESTABLECER CONTROLES
        // =====================================

        guardando = false;

        boton.disabled = false;

        detener.disabled = true;
    }
}


/* =====================================================
   CONSULTA DE FEEDBACK SIN BLOQUEAR LA PANTALLA
===================================================== */
let seguimientoActivoId = null;

async function esperarSeguimientoIA(conversacionId) {
    seguimientoActivoId = conversacionId;
    const inicio = Date.now();
    const esperaMaxima = 130000;

    while (seguimientoActivoId === conversacionId && Date.now() - inicio < esperaMaxima) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        if (seguimientoActivoId !== conversacionId) return;

        try {
            const respuesta = await fetch(
                `/estado-seguimiento/${conversacionId}/`,
                { credentials: "same-origin", cache: "no-store" }
            );
            if (!respuesta.ok) throw new Error("No se pudo consultar el seguimiento.");
            const datos = await respuesta.json();
            if (datos.estado_ia === "pendiente" || !datos.estado_ia) continue;

            if (salidaIA && seguimientoActivoId === conversacionId) {
                salidaIA.textContent = datos.seguimiento_ia ||
                    "La práctica fue guardada, pero no se obtuvo evaluación.";
                if (datos.estado_ia !== "completado") {
                    salidaIA.textContent +=
                        "\n\n(Se utilizó el análisis de respaldo porque la IA local no completó la evaluación.)";
                }
            }
            seguimientoActivoId = null;
            return;
        } catch (error) {
            console.warn("Consulta de IA:", error);
        }
    }
    if (seguimientoActivoId === conversacionId) {
        seguimientoActivoId = null;
        if (salidaIA) salidaIA.textContent =
            "El análisis está tardando más de lo esperado. La práctica ya está guardada; " +
            "puedes consultar el resultado desde Mi progreso cuando termine.";
    }
}

/* =====================================================
   ESTADO INICIAL
===================================================== */

if (detener) {
    detener.disabled = true;
}

if (cantidadPalabras) {
    cantidadPalabras.textContent = "0";
}

if (relleno) {
    relleno.textContent = "0";
}

if (repetidas) {
    repetidas.textContent = "Ninguna";
}

// Ocultar resultados visuales hasta que
// termine una práctica con MediaPipe.

mostrarResultadosVisuales({});

