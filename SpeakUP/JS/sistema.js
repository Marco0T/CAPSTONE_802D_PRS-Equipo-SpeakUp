let boton = document.getElementById("iniciar");
let detener = document.getElementById("detener");

let estado = document.getElementById("estado");
let texto = document.getElementById("texto");

let reconocimiento = new webkitSpeechRecognition();

reconocimiento.lang = "es-CL";
reconocimiento.continuous = true;
reconocimiento.interimResults = true;

let textoGuardado = "";


boton.onclick = function() {

    reconocimiento.start();

    estado.textContent = "Escuchando...";

};


detener.onclick = function() {

    reconocimiento.stop();

    estado.textContent = "Micrófono detenido";

};


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