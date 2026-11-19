console.log("SPEAKUP - CAMARA MEDIAPIPE FASE 3");

// =====================================================
// ELEMENTOS HTML
// =====================================================

const video = document.getElementById("camara");
const botonCamara = document.getElementById("activar-camara");
const estadoCamara = document.getElementById("estado-camara");
const resultadosCamara = document.getElementById("resultados-camara");

// =====================================================
// VARIABLES
// =====================================================

let streamCamara = null;
let camaraActiva = false;
let cargando = false;
let analizandoPractica = false;

let faceLandmarker = null;
let poseLandmarker = null;
let handLandmarker = null;

let FaceLandmarker = null;
let PoseLandmarker = null;
let HandLandmarker = null;
let DrawingUtils = null;

let modelosPreparados = false;
let drawingUtils = null;

let animationFrameId = null;
let ultimoAnalisis = 0;

let resultadosFinales = {};

const INTERVALO_ANALISIS = 150;

// =====================================================
// CANVAS
// =====================================================

const canvas = document.createElement("canvas");
canvas.id = "canvas-mediapipe";

canvas.style.position = "absolute";
canvas.style.inset = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.pointerEvents = "none";
canvas.style.zIndex = "2";

const contexto = canvas.getContext("2d");

// =====================================================
// ESTADÍSTICAS
// =====================================================

function crearEstadisticas() {
    return {
        fotogramas_analizados: 0,
        rostro_detectado: 0,
        cabeza_frontal: 0,
        mirada_estimada: 0,
        postura_estable: 0,
        hombros_detectados: 0,
        manos_detectadas: 0,
        movimientos_manos: 0,
        inclinaciones_cabeza: 0,
        cambios_orientacion_cabeza: 0
    };
}

let estadisticas = crearEstadisticas();

let posicionManoAnterior = null;
let posicionCuerpoAnterior = null;
let orientacionAnterior = null;
let inclinacionAnterior = false;

// =====================================================
// MOSTRAR ESTADO
// =====================================================

function actualizarEstado(mensaje) {
    console.log("Cámara:", mensaje);

    if (estadoCamara) {
        estadoCamara.textContent = mensaje;
    }
}

function mostrarError(error) {
    console.error("SpeakUP MediaPipe:", error);

    const mensaje = error?.message || String(error);

    actualizarEstado("Error: " + mensaje);
}

// =====================================================
// FUNCIONES MATEMÁTICAS
// =====================================================

function distancia(a, b) {
    if (!a || !b) return 0;

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}

function porcentaje(valor, total) {
    if (!total) return 0;

    return Math.round(
        (valor / total) * 10000
    ) / 100;
}

function reiniciarMovimientos() {
    posicionManoAnterior = null;
    posicionCuerpoAnterior = null;
    orientacionAnterior = null;
    inclinacionAnterior = false;
}

// =====================================================
// PREPARAR CANVAS
// =====================================================

function prepararCanvas() {
    if (!video || !video.parentElement) return;

    const contenedor = video.parentElement;

    if (
        getComputedStyle(contenedor).position === "static"
    ) {
        contenedor.style.position = "relative";
    }

    if (!canvas.parentElement) {
        contenedor.appendChild(canvas);
    }

    if (DrawingUtils && contexto) {
        drawingUtils = new DrawingUtils(contexto);
    }
}

// =====================================================
// CARGAR MEDIAPIPE DESDE DJANGO
// =====================================================

async function cargarModelos() {
    if (modelosPreparados) return true;

    actualizarEstado(
        "Cámara encendida. Cargando MediaPipe local..."
    );

    try {
        // Cargar MediaPipe desde los archivos estáticos de Django.
        // Ya no dependemos de jsDelivr.
        const modulo = await import(
            "/static/usuarios/mediapipe/vision_bundle.mjs"
        );

        FaceLandmarker = modulo.FaceLandmarker;
        PoseLandmarker = modulo.PoseLandmarker;
        HandLandmarker = modulo.HandLandmarker;
        DrawingUtils = modulo.DrawingUtils;

        // Comprobar que las clases estén disponibles.
        if (
            !FaceLandmarker ||
            !PoseLandmarker ||
            !HandLandmarker ||
            !modulo.FilesetResolver
        ) {
            throw new Error(
                "No se encontraron las funciones necesarias de MediaPipe."
            );
        }

        // Cargar los archivos WASM desde Django.
        const vision = await modulo.FilesetResolver.forVisionTasks(
            "/static/usuarios/mediapipe/wasm"
        );

        // =====================================================
        // MODELO DE ROSTRO
        // =====================================================

        actualizarEstado(
            "Cargando modelo de rostro..."
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numFaces: 1
            }
        );

        // =====================================================
        // MODELO DE POSTURA
        // =====================================================

        actualizarEstado(
            "Cargando modelo de postura..."
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numPoses: 1
            }
        );

        // =====================================================
        // MODELO DE MANOS
        // =====================================================

        actualizarEstado(
            "Cargando modelo de manos..."
        );

        handLandmarker = await HandLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            }
        );

        // =====================================================
        // FINALIZAR CONFIGURACIÓN
        // =====================================================

        modelosPreparados = true;

        prepararCanvas();

        actualizarEstado(
            "Cámara activa. MediaPipe funcionando."
        );

        console.log(
            "SpeakUP: MediaPipe cargado correctamente desde Django."
        );

        return true;

    } catch (error) {
        modelosPreparados = false;

        mostrarError(error);

        return false;
    }
}

// =====================================================
// ACTIVAR CÁMARA
// =====================================================

async function activarCamara() {
    if (camaraActiva || cargando) return;

    if (!video) {
        actualizarEstado(
            "Error: no se encontró el elemento de video."
        );
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        actualizarEstado(
            "El navegador no permite acceder a la cámara."
        );
        return;
    }

    cargando = true;

    if (botonCamara) {
        botonCamara.disabled = true;
    }

    try {
        actualizarEstado(
            "Solicitando permiso para usar la cámara..."
        );

        streamCamara = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = streamCamara;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;

        await video.play();

        camaraActiva = true;

        prepararCanvas();

        if (botonCamara) {
            botonCamara.textContent = "Desactivar cámara";
        }

        actualizarEstado(
            "Cámara encendida. Preparando análisis visual..."
        );

        // La cámara ya muestra imagen.
        // Ahora cargamos los modelos.
        const correcto = await cargarModelos();

        if (correcto && camaraActiva) {
            analizarVideo();
        }

    } catch (error) {
        mostrarError(error);

        // Liberar recursos sin borrar el mensaje de error.
        liberarCamara();

    } finally {
        cargando = false;

        if (botonCamara) {
            botonCamara.disabled = false;
        }
    }
}

// =====================================================
// LIBERAR RECURSOS
// =====================================================

function liberarCamara() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    camaraActiva = false;

    if (streamCamara) {
        streamCamara.getTracks().forEach(track => {
            track.stop();
        });

        streamCamara = null;
    }

    if (video) {
        video.pause();
        video.srcObject = null;
    }

    if (contexto) {
        contexto.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    if (botonCamara) {
        botonCamara.textContent = "Activar cámara";
    }
}

// =====================================================
// DESACTIVAR CÁMARA
// =====================================================

function detenerCamara() {
    if (analizandoPractica) {
        finalizarPractica();
    }

    liberarCamara();

    actualizarEstado("Cámara desactivada.");
}

// =====================================================
// INICIAR PRÁCTICA
// =====================================================

function iniciarPractica() {
    estadisticas = crearEstadisticas();
    resultadosFinales = {};

    reiniciarMovimientos();

    analizandoPractica = true;

    if (resultadosCamara) {
        resultadosCamara.textContent =
            "Práctica iniciada. Analizando movimientos...";
    }
}

// =====================================================
// FINALIZAR PRÁCTICA
// =====================================================

function finalizarPractica() {
    if (!analizandoPractica) {
        return resultadosFinales;
    }

    analizandoPractica = false;

    resultadosFinales = calcularResultados();

    mostrarResultados(resultadosFinales);

    return resultadosFinales;
}

// =====================================================
// ANALIZAR ROSTRO
// =====================================================

function analizarRostro(resultado) {
    const puntos = resultado?.faceLandmarks?.[0];

    if (!puntos || puntos.length < 468) {
        orientacionAnterior = null;
        inclinacionAnterior = false;
        return;
    }

    const nariz = puntos[1];
    const ojoIzquierdo = puntos[33];
    const ojoDerecho = puntos[263];

    const centroOjos = {
        x: (ojoIzquierdo.x + ojoDerecho.x) / 2,
        y: (ojoIzquierdo.y + ojoDerecho.y) / 2
    };

    const distanciaOjos = distancia(
        ojoIzquierdo,
        ojoDerecho
    );

    const desplazamiento = Math.abs(
        nariz.x - centroOjos.x
    );

    const frontal =
        distanciaOjos > 0 &&
        desplazamiento / distanciaOjos < 0.18;

    const inclinacion =
        distanciaOjos > 0 &&
        Math.abs(
            ojoIzquierdo.y - ojoDerecho.y
        ) / distanciaOjos > 0.15;

    if (analizandoPractica) {
        estadisticas.rostro_detectado++;

        if (frontal) {
            estadisticas.cabeza_frontal++;
            estadisticas.mirada_estimada++;
        }

        if (inclinacion && !inclinacionAnterior) {
            estadisticas.inclinaciones_cabeza++;
        }

        const orientacion = frontal
            ? "frontal"
            : "lateral";

        if (
            orientacionAnterior !== null &&
            orientacionAnterior !== orientacion
        ) {
            estadisticas.cambios_orientacion_cabeza++;
        }

        orientacionAnterior = orientacion;
    }

    inclinacionAnterior = inclinacion;
}

// =====================================================
// ANALIZAR POSTURA
// =====================================================

function analizarPostura(resultado) {
    const puntos = resultado?.landmarks?.[0];

    if (!puntos || puntos.length < 25) {
        posicionCuerpoAnterior = null;
        return;
    }

    const izquierdo = puntos[11];
    const derecho = puntos[12];

    const visibles =
        (izquierdo.visibility ?? 0) > 0.5 &&
        (derecho.visibility ?? 0) > 0.5;

    if (!visibles) {
        posicionCuerpoAnterior = null;
        return;
    }

    const centro = {
        x: (izquierdo.x + derecho.x) / 2,
        y: (izquierdo.y + derecho.y) / 2
    };

    if (analizandoPractica) {
        estadisticas.hombros_detectados++;

        if (posicionCuerpoAnterior) {
            const movimiento = distancia(
                centro,
                posicionCuerpoAnterior
            );

            if (movimiento < 0.025) {
                estadisticas.postura_estable++;
            }
        }
    }

    posicionCuerpoAnterior = centro;
}

// =====================================================
// ANALIZAR MANOS
// =====================================================

function analizarManos(resultado) {
    const manos = resultado?.landmarks || [];

    if (!manos.length) {
        posicionManoAnterior = null;
        return;
    }

    if (analizandoPractica) {
        estadisticas.manos_detectadas++;
    }

    const centros = manos.map(mano => ({
        x: (
            mano[0].x +
            mano[8].x +
            mano[20].x
        ) / 3,

        y: (
            mano[0].y +
            mano[8].y +
            mano[20].y
        ) / 3
    }));

    const centro = {
        x: centros.reduce(
            (total, punto) => total + punto.x,
            0
        ) / centros.length,

        y: centros.reduce(
            (total, punto) => total + punto.y,
            0
        ) / centros.length
    };

    if (
        analizandoPractica &&
        posicionManoAnterior
    ) {
        if (
            distancia(
                centro,
                posicionManoAnterior
            ) > 0.045
        ) {
            estadisticas.movimientos_manos++;
        }
    }

    posicionManoAnterior = centro;
}

// =====================================================
// DIBUJAR PUNTOS
// =====================================================

function dibujarResultados(rostro, postura, manos) {
    if (!drawingUtils || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    contexto.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    for (const puntos of rostro?.faceLandmarks || []) {
        drawingUtils.drawConnectors(
            puntos,
            FaceLandmarker.FACE_LANDMARKS_CONTOURS,
            {
                color: "#00E5FF",
                lineWidth: 1
            }
        );
    }

    for (const puntos of postura?.landmarks || []) {
        drawingUtils.drawConnectors(
            puntos,
            PoseLandmarker.POSE_CONNECTIONS,
            {
                color: "#00FF88",
                lineWidth: 2
            }
        );
    }

    for (const puntos of manos?.landmarks || []) {
        drawingUtils.drawConnectors(
            puntos,
            HandLandmarker.HAND_CONNECTIONS,
            {
                color: "#FFD166",
                lineWidth: 2
            }
        );
    }
}

// =====================================================
// BUCLE DE MEDIAPIPE
// =====================================================

function analizarVideo() {
    if (!camaraActiva || !modelosPreparados) return;

    const ahora = performance.now();

    if (
        video.readyState >= 2 &&
        ahora - ultimoAnalisis >= INTERVALO_ANALISIS
    ) {
        ultimoAnalisis = ahora;

        try {
            const rostro = faceLandmarker.detectForVideo(
                video,
                ahora
            );

            const postura = poseLandmarker.detectForVideo(
                video,
                ahora
            );

            const manos = handLandmarker.detectForVideo(
                video,
                ahora
            );

            if (analizandoPractica) {
                estadisticas.fotogramas_analizados++;
            }

            analizarRostro(rostro);
            analizarPostura(postura);
            analizarManos(manos);

            dibujarResultados(
                rostro,
                postura,
                manos
            );

            if (analizandoPractica) {
                mostrarResultados(calcularResultados());
            }

        } catch (error) {
            mostrarError(error);
            return;
        }
    }

    animationFrameId = requestAnimationFrame(
        analizarVideo
    );
}

// =====================================================
// CALCULAR RESULTADOS
// =====================================================

function calcularResultados() {
    const total = estadisticas.fotogramas_analizados;

    if (total <= 0) {
        return {};
    }

    return {
        fotogramas_analizados: total,

        rostro_visible: porcentaje(
            estadisticas.rostro_detectado,
            total
        ),

        orientacion_frontal: porcentaje(
            estadisticas.cabeza_frontal,
            total
        ),

        mirada_camara_estimada: porcentaje(
            estadisticas.mirada_estimada,
            total
        ),

        estabilidad_corporal: porcentaje(
            estadisticas.postura_estable,
            total
        ),

        hombros_visibles: porcentaje(
            estadisticas.hombros_detectados,
            total
        ),

        manos_visibles: porcentaje(
            estadisticas.manos_detectadas,
            total
        ),

        movimientos_manos:
            estadisticas.movimientos_manos,

        inclinaciones_cabeza:
            estadisticas.inclinaciones_cabeza,

        cambios_orientacion_cabeza:
            estadisticas.cambios_orientacion_cabeza
    };
}

// =====================================================
// MOSTRAR ESTADÍSTICAS
// =====================================================

function mostrarResultados(datos) {
    if (!resultadosCamara) return;

    if (!datos.fotogramas_analizados) {
        resultadosCamara.textContent =
            "Sin estadísticas visuales todavía.";
        return;
    }

    resultadosCamara.textContent =
        `Fotogramas: ${datos.fotogramas_analizados}\n` +
        `Rostro visible: ${datos.rostro_visible}%\n` +
        `Orientación frontal: ${datos.orientacion_frontal}%\n` +
        `Mirada estimada: ${datos.mirada_camara_estimada}%\n` +
        `Estabilidad corporal: ${datos.estabilidad_corporal}%\n` +
        `Hombros visibles: ${datos.hombros_visibles}%\n` +
        `Manos visibles: ${datos.manos_visibles}%\n` +
        `Movimientos de manos: ${datos.movimientos_manos}\n` +
        `Inclinaciones de cabeza: ${datos.inclinaciones_cabeza}\n` +
        `Cambios de orientación: ${datos.cambios_orientacion_cabeza}`;
}

// =====================================================
// OBTENER RESULTADOS
// =====================================================

function obtenerResultados() {
    if (analizandoPractica) {
        return calcularResultados();
    }

    return { ...resultadosFinales };
}

// =====================================================
// COMPROBAR CÁMARA
// =====================================================

function estaActiva() {
    return camaraActiva;
}

// =====================================================
// CONECTAR BOTÓN
// =====================================================

if (botonCamara) {
    botonCamara.addEventListener(
        "click",
        async function () {
            if (camaraActiva) {
                detenerCamara();
            } else {
                await activarCamara();
            }
        }
    );
} else {
    console.error(
        "No se encontró el botón activar-camara."
    );
}

// =====================================================
// EXPONER FUNCIONES A SISTEMA.JS
// =====================================================

window.SpeakUPCamara = {
    iniciarPractica,
    finalizarPractica,
    obtenerResultados,
    estaActiva,
    detener: detenerCamara
};

// =====================================================
// LIBERAR CÁMARA AL SALIR
// =====================================================

window.addEventListener(
    "pagehide",
    liberarCamara
);

// =====================================================
// ESTADO INICIAL
// =====================================================

actualizarEstado("Cámara desactivada.");

console.log(
    "SpeakUPCamara cargado correctamente."
);