const inputDni = document.getElementById("dni");
const mensaje = document.getElementById("mensaje");

// Detecta ENTER (teclado o escáner) - usa función reutilizable de api.js
addEnterListener("dni", registrarMovimiento);

// Función principal de registro
async function registrarMovimiento() {
    const dni = document.getElementById("dni").value;
    const punto = document.getElementById("punto").value;
    const tipo = document.getElementById("tipo").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";

    const response = await fetchAuth(`${API_BASE}/movimientos`, {
        method: "POST",
        body: JSON.stringify({
            dni,
            puntoControlId: parseInt(punto),
            tipoMovimiento: tipo
        })
    });

    if (!response) {
        mensaje.className = "error";
        mensaje.innerText = "Sesión no iniciada o expiró";
        return;
    }

    if (response.ok) {
        mensaje.className = "success";
        mensaje.innerText = "Movimiento registrado correctamente";
        document.getElementById("dni").value = "";
        document.getElementById("dni").focus();
    } else {
        mensaje.className = "error";
        mensaje.innerText = await response.text();
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

