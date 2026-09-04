let boton = document.getElementById("iniciar");
let detener = document.getElementById("detener");

let estado = document.getElementById("estado");
let texto = document.getElementById("texto");

let cantidadPalabras = document.getElementById("cantidadPalabras");
let relleno = document.getElementById("relleno");
let repetidas = document.getElementById("repetidas");
let recomendacion = document.getElementById("recomendacion");


let reconocimiento = new webkitSpeechRecognition();

reconocimiento.lang = "es-CL";
reconocimiento.continuous = true;
reconocimiento.interimResults = true;


let textoGuardado = "";


/*Inicio*/

boton.onclick = function() {

    reconocimiento.start();

    estado.textContent = "🎤 Escuchando...";

};


/*Detener*/

detener.onclick = function() {

    reconocimiento.stop();

    estado.textContent = "⏹️ Micrófono detenido";

    analizarTexto();

};


/*Voz*/

reconocimiento.onresult = function(event) {

    let textoTemporal = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {

        let resultado = event.results[i][0].transcript;

        if (event.results[i].isFinal) {

            textoGuardado += resultado + " ";

        } else {

            textoTemporal += resultado;

        }
    }

    texto.value = textoGuardado + textoTemporal;

};


/*Analisis*/

function analizarTexto() {

    let contenido = textoGuardado.toLowerCase();

    let palabras = contenido
        .trim()
        .split(/\s+/)
        .filter(Boolean);


    /*Cantidad*/

    cantidadPalabras.textContent =
        "Palabras: " + palabras.length;

    /*Relleno*/

    let palabrasRelleno = [
        "eh",
        "em",
        "mmm",
        "bueno",
        "este"
    ];

    let contadorRelleno = 0;

    for (let palabra of palabras) {

        if (palabrasRelleno.includes(palabra)) {

            contadorRelleno++;

        }
    }


    relleno.textContent =
        "Palabras de relleno: " + contadorRelleno;


    /*Repetidos*/

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
                palabra + " (" + contador[palabra] + " veces)"
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


    /*Recomendar*/

    if (contadorRelleno > 3) {

        recomendacion.textContent =
            "💡 Recomendación: intenta reducir las palabras de relleno.";

    } else {

        recomendacion.textContent =
            "💡 Recomendación: buen uso de palabras de relleno.";

    }

}