const inputDni = document.getElementById("dni");
const mensaje = document.getElementById("mensaje");

// ======================================
// ENTER (teclado o escáner)
// reutiliza helper existente de api.js
// ======================================
addEnterListener("dni", registrarMovimiento);

// ======================================
// FUNCIÓN PRINCIPAL DE REGISTRO
// ======================================
async function registrarMovimiento() {

    const dni = inputDni.value.trim();
    const punto = document.getElementById("punto").value;
    const tipo = document.getElementById("tipo").value;

    mensaje.innerText = "";

    if (!dni) {
        mensaje.className = "error";
        mensaje.innerText = "Ingrese o escanee DNI";
        inputDni.focus();
        return;
    }

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
        mensaje.innerText = "Sesión no iniciada o expirada";
        inputDni.focus();
        return;
    }

    if (response.ok) {
        mensaje.className = "success";
        mensaje.innerText = "Movimiento registrado correctamente";
        limpiarFormulario();
    } else {
        mensaje.className = "error";
        mensaje.innerText = await response.text();
        inputDni.focus();
    }
}

// ======================================
// LIMPIAR Y ENFOCAR (FLUJO ESCÁNER)
// ======================================
function limpiarFormulario() {
    inputDni.value = "";
    inputDni.focus();
}

// ======================================
// FOCO PERMANENTE (ESCÁNER REAL)
// ======================================
setInterval(() => {
    if (document.activeElement !== inputDni) {
        inputDni.focus();
    }
}, 1000);

/*
NOTA FUTURA:
- En modo scanner:
  - El punto de control se define por el dispositivo (IP / config)
  - El tipo (Entrada / Salida) se puede inferir automáticamente
  - El operador no necesita usar mouse ni teclado
*/
