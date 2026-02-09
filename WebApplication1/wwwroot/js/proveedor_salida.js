// =========================================
// SALIDA DE PROVEEDOR (Sin Vehiculo)
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombres").value = params.get("nombres") || "";
    document.getElementById("apellidos").value = params.get("apellidos") || "";
    document.getElementById("procedencia").value = params.get("procedencia") || "";
    document.getElementById("destino").value = params.get("destino") || "";
    document.getElementById("observacion").value = params.get("observacion") || "";
}

async function registrarSalida() {
    const dni = document.getElementById("dni").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
    const procedencia = document.getElementById("procedencia").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!dni || !nombres || !apellidos || !procedencia || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Faltan datos del proveedor para registrar la salida";
        return;
    }

    try {
        const responseSalida = await fetchAuth(`${API_BASE}/proveedor`, {
            method: "POST",
            body: JSON.stringify({
                dni,
                nombres,
                apellidos,
                procedencia,
                destino,
                horaSalida: new Date().toISOString(),
                observacion: observacion || null
            })
        });

        if (!responseSalida.ok) {
            const error = await responseSalida.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ SALIDA registrada correctamente";

        // Mantener observacion visible y dejar que el usuario vuelva manualmente
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "proveedor.html?refresh=1";
}
