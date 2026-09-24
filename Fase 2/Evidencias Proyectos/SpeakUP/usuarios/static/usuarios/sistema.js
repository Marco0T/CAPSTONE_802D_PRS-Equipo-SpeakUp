console.log("SISTEMA.JS FUNCIONANDO");


/* ============================= */
/* ELEMENTOS */
/* ============================= */

let boton = document.getElementById("iniciar");
let detener = document.getElementById("detener");

let estado = document.getElementById("estado");
let texto = document.getElementById("texto");

let cantidadPalabras = document.getElementById("cantidadPalabras");
let relleno = document.getElementById("relleno");
let repetidas = document.getElementById("repetidas");
let recomendacion = document.getElementById("recomendacion");

let consejoSituacion = document.getElementById("consejoSituacion");


/* ============================= */
/* SITUACIÓN */
/* ============================= */

let situaciones = document.getElementsByName("situacion");


/* ============================= */
/* RECONOCIMIENTO DE VOZ */
/* ============================= */

let reconocimiento;

if ("webkitSpeechRecognition" in window) {

    reconocimiento = new webkitSpeechRecognition();

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


/* ============================= */
/* COMENZAR */
/* ============================= */

boton.onclick = function () {

    if (!reconocimiento) {
        return;
    }

    textoGuardado = "";

    texto.value = "";

    reconocimiento.start();

    escuchando = true;

    estado.textContent = "Escuchando...";

};


/* ============================= */
/* DETENER */
/* ============================= */

detener.onclick = function () {

    if (!reconocimiento) {
        return;
    }

    reconocimiento.stop();

    escuchando = false;

    estado.textContent = "Micrófono detenido";

    analizarTexto();

};


/* ============================= */
/* RECONOCIMIENTO DE VOZ */
/* ============================= */

if (reconocimiento) {

    reconocimiento.onresult = function (event) {

        let textoTemporal = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            let resultado =
                event.results[i][0].transcript;


            if (event.results[i].isFinal) {

                textoGuardado += resultado + " ";

            } else {

                textoTemporal += resultado;

            }

        }


        texto.value =
            textoGuardado + textoTemporal;

    };


    reconocimiento.onerror = function (event) {

        console.log(
            "Error de reconocimiento:",
            event.error
        );

        estado.textContent =
            "Error del micrófono";

    };


    reconocimiento.onend = function () {

        if (escuchando) {

            reconocimiento.start();

        }

    };

}


/* ============================= */
/* ANALIZAR TEXTO */
/* ============================= */

function analizarTexto() {

    let contenido =
        textoGuardado.toLowerCase();


    let palabras = contenido
        .trim()
        .split(/\s+/)
        .filter(Boolean);


    /* ============================= */
    /* CANTIDAD DE PALABRAS */
    /* ============================= */

    cantidadPalabras.textContent =
        "Palabras: " + palabras.length;


    /* ============================= */
    /* PALABRAS DE RELLENO */
    /* ============================= */

    let palabrasRelleno = [
        "eh",
        "em",
        "mmm",
        "bueno",
        "este",
        "o sea"
    ];


    let contadorRelleno = 0;


    for (let palabra of palabras) {

        if (palabrasRelleno.includes(palabra)) {

            contadorRelleno++;

        }

    }


    relleno.textContent =
        "Palabras de relleno: " +
        contadorRelleno;


    /* ============================= */
    /* PALABRAS REPETIDAS */
    /* ============================= */

    let contador = {};


    for (let palabra of palabras) {

        if (contador[palabra]) {

            contador[palabra]++;

        } else {

            contador[palabra] = 1;

        }

    }


    let listaRepetidas = [];


    for (let palabra in contador) {

        if (contador[palabra] > 1) {

            listaRepetidas.push(
                palabra +
                " (" +
                contador[palabra] +
                " veces)"
            );

        }

    }


    if (listaRepetidas.length > 0) {

        repetidas.textContent =
            "Palabras repetidas: " +
            listaRepetidas.join(", ");

    } else {

        repetidas.textContent =
            "Palabras repetidas: Ninguna";

    }


    /* ============================= */
    /* RECOMENDACIÓN GENERAL */
    /* ============================= */

    if (contadorRelleno > 3) {

        recomendacion.textContent =
            "Recomendación: intenta reducir las palabras de relleno.";

    } else {

        recomendacion.textContent =
            "Recomendación: buen uso de palabras de relleno.";

    }


    /* ============================= */
    /* CONSEJO SEGÚN SITUACIÓN */
    /* ============================= */

    mostrarConsejo();

}


/* ============================= */
/* CONSEJOS */
/* ============================= */

function mostrarConsejo() {

    let situacionSeleccionada =
        "presentacion";


    for (let opcion of situaciones) {

        if (opcion.checked) {

            situacionSeleccionada =
                opcion.value;

        }

    }


    /* PRESENTACIÓN */

    if (situacionSeleccionada === "presentacion") {

        consejoSituacion.textContent =
            "Para una presentación, intenta comenzar explicando claramente tu idea, hablar con seguridad y mantener un ritmo constante. Evita usar demasiadas palabras de relleno.";

    }


    /* ENTREVISTA */

    if (situacionSeleccionada === "entrevista") {

        consejoSituacion.textContent =
            "Para una entrevista laboral, intenta responder de forma clara y directa. Explica tus experiencias, destaca tus habilidades y evita respuestas demasiado largas.";

    }

}