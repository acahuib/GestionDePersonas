const inputDni = document.getElementById("dni");
const mensaje = document.getElementById("mensaje");

// Detecta ENTER (teclado o escáner)
inputDni.addEventListener("keydown", (e) => {

    if (e.key === "Enter") {
        e.preventDefault(); // evita recarga del formulario
        registrarMovimiento();
    }

});

// Función principal de registro
async function registrarMovimiento() {

    const dni = inputDni.value.trim();
    const punto = document.getElementById("punto").value;
    const tipo = document.getElementById("tipo").value;

    mensaje.innerText = "";

    // Validación mínima
    if (!dni) {
        mensaje.className = "error";
        mensaje.innerText = "Ingrese o escanee un DNI";
        inputDni.focus();
        return;
    }

    try {

        const response = await fetch(`${API_BASE}/movimientos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                dni,
                puntoControlId: parseInt(punto),
                tipoMovimiento: tipo
            })
        });

        if (response.ok) {
            mensaje.className = "success";
            mensaje.innerText = "Movimiento registrado correctamente";
            limpiarFormulario();
        } else {
            mensaje.className = "error";
            mensaje.innerText = await response.text();
            inputDni.focus();
        }

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = "Error de conexión con el servidor";
        inputDni.focus();
    }
}

// Limpia y enfoca (flujo tipo escáner)
function limpiarFormulario() {
    inputDni.value = "";
    inputDni.focus();
}

/*
NOTA FUTURA:
- En modo scanner:
  - El punto de control se define por el dispositivo (IP / config)
  - El tipo (Entrada / Salida) se puede inferir automáticamente
  - El operador no necesita usar mouse ni teclado
*/

